import { Link } from 'react-router-dom';

const languageColors = {
  JavaScript: '#F7DF1E',
  TypeScript: '#3178C6',
  Python: '#3776AB',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Java: '#B07219',
  Ruby: '#CC342D',
  HTML: '#E34F26',
  CSS: '#1572B6',
  C: '#555555',
  'C++': '#F34B7D',
  'C#': '#178600',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89E051',
};

function timeAgo(dateString) {
  if (!dateString) return 'recently';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function RepositoryCard({
  repo,
  onConnect,
  isConnecting,
  onAnalyze,
  isAnalyzing,
}) {
  const dotColor = languageColors[repo.language] || '#64748B';

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel transition-all duration-200 hover:border-graphite-600 hover:shadow-panel-hover">
      {/* Top highlight hairline */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-graphite-600/30 to-transparent" />

      <div>
        {/* Repo Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-mono text-sm font-semibold text-mist-100 hover:text-amber-400 transition-colors truncate"
              title={repo.fullName}
            >
              <svg className="h-4 w-4 shrink-0 text-mist-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
              </svg>
              <span className="truncate">{repo.name}</span>
            </a>
            <p className="font-mono text-[10px] text-mist-500 truncate mt-0.5">
              {repo.fullName}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider ${
              repo.private
                ? 'border border-graphite-700 bg-graphite-800 text-mist-400'
                : 'border border-amber-400/20 bg-amber-400/10 text-amber-400'
            }`}
          >
            {repo.private ? 'Private' : 'Public'}
          </span>
        </div>

        {/* Description */}
        <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-mist-400">
          {repo.description || 'No repository description provided.'}
        </p>

        {/* Metadata row */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-mist-500 font-mono">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-mist-300 text-[11px]">{repo.language}</span>
            </span>
          )}

          <span className="flex items-center gap-1 text-[11px]">
            <span className="text-amber-400/80">★</span>
            <span>{repo.stars ?? 0}</span>
          </span>

          <span className="flex items-center gap-1 text-[11px]">
            <span>⑂</span>
            <span>{repo.forks ?? 0}</span>
          </span>

          <span className="text-[11px] text-mist-500">
            {timeAgo(repo.updatedAt)}
          </span>
        </div>

        {/* View last analysis indicator */}
        {repo.hasAnalysis && repo.repositoryId && (
          <div className="mt-3 border-t border-graphite-800/80 pt-2.5">
            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/analysis`}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:underline"
            >
              <span>View last code review</span>
              <span>→</span>
            </Link>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-5 space-y-2 pt-3 border-t border-graphite-800/80">
        <div className="flex gap-2">
          {!repo.connected ? (
            <button
              onClick={() => onConnect(repo.githubId)}
              disabled={isConnecting}
              className="flex-1 rounded-lg border border-graphite-600 bg-graphite-800 px-3 py-2 text-xs font-semibold text-mist-100 transition-colors hover:bg-graphite-700 hover:border-graphite-500 disabled:opacity-60"
            >
              {isConnecting ? 'Connecting…' : 'Connect Repository'}
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
              <span className="mr-1">✓</span> Connected
            </div>
          )}

          <button
            onClick={() => onAnalyze(repo)}
            disabled={isAnalyzing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm active:scale-95"
          >
            {isAnalyzing ? (
              <>
                <span className="h-2 w-2 rounded-full bg-graphite-950 animate-ping" />
                <span>Starting…</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Analyze</span>
              </>
            )}
          </button>
        </div>

        {/* Secondary AI Actions when connected */}
        {repo.connected && repo.repositoryId && (
          <div className="flex gap-2 pt-0.5">
            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/chat`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-800/70 px-2.5 py-1.5 text-center text-xs font-medium text-mist-300 transition-colors hover:border-sky-400/40 hover:bg-graphite-800 hover:text-sky-300"
            >
              <span>💬</span>
              <span>Chat</span>
            </Link>
            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/architecture`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-800/70 px-2.5 py-1.5 text-center text-xs font-medium text-mist-300 transition-colors hover:border-purple-400/40 hover:bg-graphite-800 hover:text-purple-300"
            >
              <span>🕸</span>
              <span>Architecture</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
