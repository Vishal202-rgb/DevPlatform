import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'connected' | 'analyzed' | 'public' | 'private'
  const [selectedRepoOverview, setSelectedRepoOverview] = useState(null);

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
    } else if (statusFilter === 'analyzed') {
      result = result.filter((r) => r.hasAnalysis || r.lastAnalyzedAt);
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
        repo.language?.toLowerCase().includes(query) ||
        repo.githubOwner?.toLowerCase().includes(query)
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
        <div className="border-b border-graphite-800 pb-5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Code Intelligence</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Repositories</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Repository Catalog
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Link your GitHub account to access your public and private repositories.
          </p>
        </div>

        <EmptyState
          icon={
            <svg viewBox="0 0 16 16" className="h-6 w-6" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          }
          title="GitHub is not connected"
          description="Connect your GitHub account to automatically synchronize public and private repositories for AI-powered static analysis, bug remediation, test suites, and architecture graphs."
          actionLabel="Connect GitHub Account"
          onAction={connect}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Code Intelligence</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Repository Catalog</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Repositories
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Select any repository to review AST vulnerabilities, run codebase chat, or visualize modular architecture.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRepos}
            disabled={isLoading}
            className="btn-secondary !text-xs !py-2 !px-3.5"
            title="Refresh from GitHub"
          >
            <svg
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isLoading ? 'Syncing…' : 'Sync Repositories'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 animate-fade-in font-mono">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={loadRepos}
            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
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
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories by name, language, owner…"
                className="w-full rounded-lg border border-graphite-750 bg-graphite-900 py-2 pl-9 pr-9 text-xs sm:text-sm text-mist-100 outline-none transition-colors placeholder:text-mist-500 focus:border-amber-400 focus:bg-graphite-850"
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
            <div className="flex items-center gap-1 rounded-lg border border-graphite-750 bg-graphite-900 p-1 font-mono text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'connected', label: 'Connected' },
                { id: 'analyzed', label: 'Analyzed' },
                { id: 'public', label: 'Public' },
                { id: 'private', label: 'Private' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-amber-400 text-graphite-950 font-bold shadow-sm'
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
                Reset search
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
              onSelectOverview={(r) => setSelectedRepoOverview(r)}
            />
          ))}
        </div>
      )}

      {/* Selected Repository Detailed Overview Drawer / Modal */}
      {selectedRepoOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-graphite-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl border border-graphite-700 bg-graphite-900 p-6 shadow-2xl animate-scale-in space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-graphite-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-mist-400">
                    @{selectedRepoOverview.githubOwner || selectedRepoOverview.fullName?.split('/')[0]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium uppercase ${
                      selectedRepoOverview.private
                        ? 'border border-graphite-700 bg-graphite-800 text-mist-400'
                        : 'border border-amber-400/20 bg-amber-400/10 text-amber-400'
                    }`}
                  >
                    {selectedRepoOverview.private ? 'Private' : 'Public'}
                  </span>
                </div>
                <h2 className="text-xl font-bold font-mono text-mist-100 mt-1">
                  {selectedRepoOverview.name}
                </h2>
                <p className="text-xs text-mist-400 mt-0.5">
                  {selectedRepoOverview.description || 'No description provided.'}
                </p>
              </div>

              <button
                onClick={() => setSelectedRepoOverview(null)}
                className="rounded-lg p-1.5 text-mist-400 hover:bg-graphite-800 hover:text-mist-100"
              >
                ✕
              </button>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
              <div className="rounded-xl border border-graphite-750 bg-graphite-850 p-3">
                <span className="text-[10px] uppercase text-mist-500 block">Default Branch</span>
                <span className="text-sm font-bold text-mist-100 mt-0.5 block">
                  ⑂ {selectedRepoOverview.defaultBranch || 'main'}
                </span>
              </div>

              <div className="rounded-xl border border-graphite-750 bg-graphite-850 p-3">
                <span className="text-[10px] uppercase text-mist-500 block">Language</span>
                <span className="text-sm font-bold text-amber-400 mt-0.5 block">
                  {selectedRepoOverview.language || 'Unknown'}
                </span>
              </div>

              <div className="rounded-xl border border-graphite-750 bg-graphite-850 p-3">
                <span className="text-[10px] uppercase text-mist-500 block">Stars &amp; Forks</span>
                <span className="text-sm font-bold text-mist-100 mt-0.5 block">
                  ★ {selectedRepoOverview.stars || 0} · ⑂ {selectedRepoOverview.forks || 0}
                </span>
              </div>

              <div className="rounded-xl border border-graphite-750 bg-graphite-850 p-3">
                <span className="text-[10px] uppercase text-mist-500 block">Analysis Status</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {selectedRepoOverview.hasAnalysis ? 'Audited' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="space-y-2 border-t border-graphite-800 pt-4">
              <span className="text-xs font-mono uppercase text-mist-400 block font-semibold">
                Available Engineering Actions
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const r = selectedRepoOverview;
                    setSelectedRepoOverview(null);
                    handleAnalyze(r);
                  }}
                  className="btn-primary"
                >
                  <span>⚡</span>
                  <span>Run Analysis</span>
                </button>

                {selectedRepoOverview.repositoryId && (
                  <>
                    <Link
                      to={`/dashboard/repositories/${selectedRepoOverview.repositoryId}/architecture`}
                      className="btn-secondary !text-xs !py-2.5 text-purple-300 hover:text-purple-200"
                    >
                      <span>🗺️</span>
                      <span>Architecture</span>
                    </Link>

                    <Link
                      to={`/dashboard/repositories/${selectedRepoOverview.repositoryId}/chat`}
                      className="btn-secondary !text-xs !py-2.5 text-sky-300 hover:text-sky-200"
                    >
                      <span>💬</span>
                      <span>AI Chat</span>
                    </Link>

                    <Link
                      to={`/dashboard/repositories/${selectedRepoOverview.repositoryId}/analysis`}
                      className="btn-secondary !text-xs !py-2.5 text-amber-300 hover:text-amber-200"
                    >
                      <span>🛡️</span>
                      <span>Issues</span>
                    </Link>

                    <Link
                      to="/dashboard/tests"
                      className="btn-secondary !text-xs !py-2.5 text-emerald-300 hover:text-emerald-200"
                    >
                      <span>🧪</span>
                      <span>Tests</span>
                    </Link>

                    <Link
                      to="/dashboard/pull-requests"
                      className="btn-secondary !text-xs !py-2.5 text-indigo-300 hover:text-indigo-200"
                    >
                      <span>🔀</span>
                      <span>PRs</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}