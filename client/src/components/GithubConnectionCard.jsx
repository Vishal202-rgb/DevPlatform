import { Link } from 'react-router-dom';
import { useGithubConnection } from '../hooks/useGithubConnection';
import { Skeleton } from './Skeleton';

export default function GithubConnectionCard({ banner }) {
  const { isConnected, githubProfile, isLoading, error, connect, disconnect } =
    useGithubConnection();

  return (
    <div className="relative overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel transition-all">
      {/* Subtle background glow */}
      <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-amber-400/5 blur-3xl pointer-events-none" />

      {banner && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium animate-fade-in ${
            banner.type === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          <span>{banner.type === 'error' ? '✕' : '✓'}</span>
          <span>{banner.message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      ) : isConnected ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img
                src={githubProfile.avatarUrl}
                alt={githubProfile.username}
                className="h-11 w-11 rounded-full border border-graphite-600 bg-graphite-800 object-cover shadow-sm"
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-graphite-900 bg-emerald-500" title="Connected" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <a
                  href={githubProfile.profileUrl || `https://github.com/${githubProfile.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-semibold text-mist-100 hover:text-amber-400 transition-colors"
                >
                  @{githubProfile.username}
                </a>
                <span className="rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
                  Synced
                </span>
              </div>
              <p className="mt-0.5 text-xs text-mist-500">
                Connected {new Date(githubProfile.connectedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/repositories"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-500 shadow-sm active:scale-95"
            >
              <span>Browse Repositories</span>
              <span>→</span>
            </Link>
            <button
              onClick={() => {
                if (window.confirm('Disconnect your GitHub account from DevPlatform?')) {
                  disconnect();
                }
              }}
              className="rounded-lg border border-graphite-600 bg-graphite-800 px-3 py-2 text-xs font-medium text-mist-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-graphite-800 border border-graphite-700 text-mist-300">
              <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-mist-100">Connect your GitHub account</p>
              <p className="mt-0.5 text-xs text-mist-400">
                Synchronize your repositories to unlock automated AI code reviews, bug fixes, and architecture graphs.
              </p>
            </div>
          </div>

          <button
            onClick={connect}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-mist-100 px-4 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-white shadow-sm active:scale-95"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Connect with GitHub
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400 font-mono">{error}</p>}
    </div>
  );
}
