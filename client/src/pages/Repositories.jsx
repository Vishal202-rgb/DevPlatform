import { useEffect, useState } from 'react';
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

  // "Analyze Repository": connects the repo first if it isn't already saved
  // (the analysis endpoints need the Mongo repositoryId, not the GitHub id),
  // then jumps to the analysis dashboard and auto-runs Gemini.
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
        <Link
          to="/dashboard"
          className="text-sm text-mist-500 hover:text-amber-400"
        >
          ← Back to overview
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-sm text-mist-500">Loading repositories…</p>
      ) : repos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="text-sm text-mist-500">No repositories found on this GitHub account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
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
