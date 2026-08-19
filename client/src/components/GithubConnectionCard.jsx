import { Link } from 'react-router-dom';
import { useGithubConnection } from '../hooks/useGithubConnection';

export default function GithubConnectionCard({ banner }) {
  const { isConnected, githubProfile, isLoading, error, connect, disconnect } =
    useGithubConnection();

  return (
    <div className="rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel">
      {banner && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            banner.type === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}
        >
          {banner.message}
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-sm text-mist-500">Checking GitHub connection…</p>
      ) : isConnected ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={githubProfile.avatarUrl}
              alt={githubProfile.username}
              className="h-10 w-10 rounded-full border border-graphite-600"
            />
            <div>
              <p className="text-sm text-mist-100">
                Connected as{' '}
                <span className="font-mono text-amber-400">@{githubProfile.username}</span>
              </p>
              <p className="text-xs text-mist-500">
                Since {new Date(githubProfile.connectedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard/repositories"
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
            >
              View repositories
            </Link>
            <button
              onClick={disconnect}
              className="rounded-lg border border-graphite-600 px-4 py-2 text-sm text-mist-300 transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-mist-100">GitHub isn't connected yet</p>
            <p className="mt-1 text-xs text-mist-500">
              Connect your account to pull in repositories for analysis.
            </p>
          </div>
          <button
            onClick={connect}
            className="flex items-center gap-2 rounded-lg bg-mist-100 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-white"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07
                -1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0
                .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44
                1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54
                1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Connect GitHub
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
