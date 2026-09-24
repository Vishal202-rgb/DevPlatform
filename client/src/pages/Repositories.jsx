import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RepositoryCard from '../components/RepositoryCard';
import EmptyState from '../components/EmptyState';
import { RepositoryCardSkeleton } from '../components/Skeleton';
import { useGithubConnection } from '../hooks/useGithubConnection';
import { useToast } from '../hooks/useToast';
import { fetchGithubRepositories, connectRepository } from '../services/githubService';

export default function Repositories() {
  const { isConnected, isLoading: isCheckingConnection, connect } = useGithubConnection();
  const navigate = useNavigate();
  const toast = useToast();

  const [repos, setRepos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectingId, setConnectingId] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'connected' | 'public' | 'private'

  const loadRepos = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchGithubRepositories();
      setRepos(data || []);
    } catch (err) {
      const msg = err.message || 'Failed to load repositories from GitHub.';
      setError(msg);
      toast.error(msg, 'GitHub Sync Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadRepos();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const handleConnect = async (githubId) => {
    setConnectingId(githubId);
    try {
      const repository = await connectRepository(githubId);
      setRepos((prev) =>
        prev.map((r) =>
          r.githubId === githubId ? { ...r, connected: true, repositoryId: repository._id } : r
        )
      );
      toast.success('Repository connected and ready for AI review.', 'Connected');
      return repository;
    } catch (err) {
      const msg = err.message || 'Failed to connect repository.';
      setError(msg);
      toast.error(msg, 'Connection Failed');
      return null;
    } finally {
      setConnectingId(null);
    }
  };

  const handleAnalyze = async (repo) => {
    if (analyzingId) return;
    setError('');
    setAnalyzingId(repo.githubId);
    try {
      let repositoryId = repo.repositoryId;
      if (!repositoryId) {
        const repository = await handleConnect(repo.githubId);
        if (!repository) return;
        repositoryId = repository._id;
      }
      navigate(`/dashboard/repositories/${repositoryId}/analysis?autorun=1`);
    } finally {
      setAnalyzingId(null);
    }
  };

  // Filter repos by search and category
  const filteredRepos = useMemo(() => {
    let result = repos;

    if (statusFilter === 'connected') {
      result = result.filter((r) => r.connected);
    } else if (statusFilter === 'public') {
      result = result.filter((r) => !r.private);
    } else if (statusFilter === 'private') {
      result = result.filter((r) => r.private);
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return result;

    return result.filter((repo) => {
      return (
        repo.name?.toLowerCase().includes(query) ||
        repo.fullName?.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query) ||
        repo.language?.toLowerCase().includes(query)
      );
    });
  }, [repos, searchQuery, statusFilter]);

  if (isCheckingConnection) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton-shimmer rounded-lg" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepositoryCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
            Repositories
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Link your GitHub account to access your repositories.
          </p>
        </div>

        <EmptyState
          icon="🐙"
          title="GitHub is not connected"
          description="Connect your GitHub account to automatically synchronize public and private repositories for AI-powered static analysis and code generation."
          actionLabel="Connect GitHub Account"
          onAction={connect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
            Repositories
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Select any repository to review AST vulnerabilities, run codebase chat, or visualize architecture.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRepos}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:bg-graphite-700 hover:text-mist-100 disabled:opacity-50"
            title="Refresh from GitHub"
          >
            <span className={isLoading ? 'animate-spin' : ''}>⟳</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
          <button
            onClick={loadRepos}
            className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      {!isLoading && repos.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500"
                viewBox="0 0 20 20"
                fill="none"
              >
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, description, or language…"
                className="w-full rounded-lg border border-graphite-700 bg-graphite-900 py-2 pl-9 pr-9 text-xs sm:text-sm text-mist-100 outline-none transition-colors placeholder:text-mist-500 focus:border-amber-400 focus:bg-graphite-850"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-500 hover:text-mist-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-graphite-700 bg-graphite-900 p-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'connected', label: 'Connected' },
                { id: 'public', label: 'Public' },
                { id: 'private', label: 'Private' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-amber-400 text-graphite-950 font-semibold shadow-sm'
                      : 'text-mist-400 hover:text-mist-100 hover:bg-graphite-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-mist-500 font-mono">
            <span>
              Showing {filteredRepos.length} of {repos.length} repositories
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-amber-400 hover:underline"
              >
                Reset filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Repositories Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepositoryCardSkeleton key={i} />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <EmptyState
          icon="📂"
          title="No repositories found"
          description="We couldn't detect any repositories in your GitHub account. Check your GitHub permissions or try re-connecting."
          actionLabel="Re-check Repositories"
          onAction={loadRepos}
        />
      ) : filteredRepos.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No repositories match your criteria"
          description={`No repositories found matching "${searchQuery || statusFilter}". Try adjusting your keywords or category filters.`}
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRepos.map((repo) => (
            <RepositoryCard
              key={repo.githubId}
              repo={repo}
              onConnect={handleConnect}
              isConnecting={connectingId === repo.githubId}
              onAnalyze={handleAnalyze}
              isAnalyzing={analyzingId === repo.githubId}
            />
          ))}
        </div>
      )}
    </div>
  );
}