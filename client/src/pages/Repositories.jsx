import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RepositoryCard from '../components/RepositoryCard';
import { useGithubConnection } from '../hooks/useGithubConnection';
import { fetchGithubRepositories, connectRepository } from '../services/githubService';

export default function Repositories() {
  const { isConnected, isLoading: isCheckingConnection, connect } = useGithubConnection();
  const navigate = useNavigate();

  const [repos, setRepos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectingId, setConnectingId] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadRepos = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchGithubRepositories();
      setRepos(data);
    } catch (err) {
      setError(err.message || 'Failed to load repositories.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadRepos();
    else setIsLoading(false);
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
      return repository;
    } catch (err) {
      setError(err.message || 'Failed to connect repository.');
      return null;
    } finally {
      setConnectingId(null);
    }
  };

  const handleAnalyze = async (repo) => {
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

  // Client-side search: name, full name, description, and language.
  // Everything is already fetched (all pages), so filtering in-memory as the
  // user types is instant with no extra API calls.
  const filteredRepos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return repos;
    return repos.filter((repo) => {
      return (
        repo.name?.toLowerCase().includes(query) ||
        repo.fullName?.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query) ||
        repo.language?.toLowerCase().includes(query)
      );
    });
  }, [repos, searchQuery]);

  if (isCheckingConnection) {
    return <p className="font-mono text-sm text-mist-500">Checking GitHub connection…</p>;
  }

  if (!isConnected) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Repositories</h1>
        <div className="mt-6 rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="font-mono text-sm text-amber-400">GitHub isn't connected</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
            Connect your GitHub account to see your repositories here.
          </p>
          <button
            onClick={connect}
            className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
          >
            Connect GitHub
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Repositories</h1>
          <p className="mt-1 text-sm text-mist-500">
            Pulled live from your GitHub account. Connect a repo to prep it for analysis.
          </p>
        </div>
        <Link to="/dashboard" className="text-sm text-mist-500 hover:text-amber-400">
          ← Back to overview
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {!isLoading && repos.length > 0 && (
        <div className="sticky top-0 z-10 -mt-2 mb-5 border-b border-graphite-800 bg-graphite-950 pb-4 pt-2">
          <div className="rounded-xl border border-graphite-700 bg-graphite-900 p-3 shadow-panel">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories by name, description, or language…"
                className="w-full rounded-lg border border-graphite-600 bg-graphite-800 py-2.5 pl-9 pr-9 text-sm text-mist-100 outline-none transition-colors placeholder:text-mist-500 focus:border-amber-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-500 hover:text-mist-100"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="mt-2 px-0.5 text-xs text-mist-500">
              {searchQuery
                ? `${filteredRepos.length} of ${repos.length} repositories match "${searchQuery}"`
                : `${repos.length} repositories`}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-sm text-mist-500">Loading repositories…</p>
      ) : repos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="text-sm text-mist-500">No repositories found on this GitHub account.</p>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="text-sm text-mist-500">
            No repositories match <span className="text-mist-100">"{searchQuery}"</span>.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 text-sm text-amber-400 hover:underline"
          >
            Clear search
          </button>
        </div>
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