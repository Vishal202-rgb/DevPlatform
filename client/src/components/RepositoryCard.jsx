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
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
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
  onSelectOverview,
}) {
  const dotColor = languageColors[repo.language] || '#64748B';
  const owner = repo.githubOwner || repo.fullName?.split('/')[0] || 'github';
  const lastAnalyzed = timeAgo(repo.lastAnalyzedAt || repo.lastAnalysis?.createdAt);
  const totalIssues = repo.lastAnalysis?.summary?.totalIssues;
  const criticalIssues = repo.lastAnalysis?.summary?.critical;
  const filesCount = repo.lastAnalysis?.filesAnalyzed;

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-5 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:shadow-panel-hover hover:-translate-y-0.5">
      {/* Top highlight hairline */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-graphite-600/25 to-transparent pointer-events-none" />

      <div className="space-y-3">
        {/* Repo Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] font-mono text-mist-500">
              <span className="truncate">@{owner}</span>
              <span>/</span>
            </div>
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-mono text-sm font-bold text-mist-100 hover:text-amber-400 transition-colors truncate mt-0.5"
              title={repo.fullName}
            >
              <svg className="h-4 w-4 shrink-0 text-mist-400" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
              </svg>
              <span className="truncate">{repo.name}</span>
            </a>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {repo.defaultBranch && (
              <span className="rounded bg-graphite-800 border border-graphite-700 px-1.5 py-0.5 text-[10px] font-mono text-mist-400" title="Default Branch">
                ⑂ {repo.defaultBranch}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider ${
                repo.private
                  ? 'border border-graphite-700 bg-graphite-800 text-mist-400'
                  : 'border border-amber-400/20 bg-amber-400/10 text-amber-400'
              }`}
            >
              {repo.private ? 'Private' : 'Public'}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-mist-400">
          {repo.description || 'No repository description provided.'}
        </p>

        {/* Metadata & Analysis Status Pill */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist-400 font-mono pt-1">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full shadow-sm"
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

          {lastAnalyzed ? (
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 text-[10px] text-emerald-400 font-medium">
              Audited {lastAnalyzed}
            </span>
          ) : (
            <span className="rounded-full bg-graphite-800 border border-graphite-750 px-2 py-0.2 text-[10px] text-mist-500">
              Not analyzed
            </span>
          )}
        </div>

        {/* Statistics Grid (Files, Issues, Critical, Dependencies) */}
        {(repo.connected || repo.hasAnalysis) && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-graphite-800 font-mono text-center">
            <div className="rounded-lg bg-graphite-850 p-2 border border-graphite-800/80">
              <span className="text-[10px] text-mist-500 uppercase block">Files</span>
              <span className="text-xs font-bold text-mist-200">
                {filesCount !== undefined ? filesCount : '—'}
              </span>
            </div>

            <div className="rounded-lg bg-graphite-850 p-2 border border-graphite-800/80">
              <span className="text-[10px] text-mist-500 uppercase block">Issues</span>
              <span className={`text-xs font-bold ${totalIssues > 0 ? 'text-amber-400' : 'text-mist-200'}`}>
                {totalIssues !== undefined ? totalIssues : '—'}
              </span>
            </div>

            <div className="rounded-lg bg-graphite-850 p-2 border border-graphite-800/80">
              <span className="text-[10px] text-rose-400 uppercase block font-semibold">Critical</span>
              <span className={`text-xs font-bold ${criticalIssues > 0 ? 'text-rose-400' : 'text-mist-200'}`}>
                {criticalIssues !== undefined ? criticalIssues : '0'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Primary & Secondary Action Hub */}
      <div className="mt-4 space-y-2 pt-3 border-t border-graphite-800">
        {/* Main Connect / Analyze row */}
        <div className="flex gap-2">
          {!repo.connected ? (
            <button
              onClick={() => onConnect(repo.githubId)}
              disabled={isConnecting}
              className="flex-1 rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-2 text-xs font-semibold text-mist-100 transition-colors hover:bg-graphite-750 hover:border-graphite-600 disabled:opacity-60"
            >
              {isConnecting ? 'Connecting…' : 'Connect Repository'}
            </button>
          ) : (
            <button
              onClick={() => onSelectOverview?.(repo)}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 font-mono hover:bg-emerald-500/20 transition-colors"
            >
              <span>✓ Connected</span>
              <span className="text-[10px] text-emerald-300">· Overview</span>
            </button>
          )}

          <button
            onClick={() => onAnalyze(repo)}
            disabled={isAnalyzing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm active:scale-95"
          >
            {isAnalyzing ? (
              <>
                <span className="h-2 w-2 rounded-full bg-graphite-950 animate-ping" />
                <span>Starting…</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" />
                </svg>
                <span>Analyze</span>
              </>
            )}
          </button>
        </div>

        {/* 6 Direct Actions when Connected */}
        {repo.connected && repo.repositoryId && (
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/architecture`}
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-mist-300 hover:text-purple-300 hover:border-purple-400/40 hover:bg-graphite-800 transition-colors truncate"
              title="View Architecture 2D Graph"
            >
              🗺️ Graph
            </Link>

            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/chat`}
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-mist-300 hover:text-sky-300 hover:border-sky-400/40 hover:bg-graphite-800 transition-colors truncate"
              title="Chat with repository codebase"
            >
              💬 AI Chat
            </Link>

            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/analysis`}
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-mist-300 hover:text-amber-400 hover:border-amber-400/40 hover:bg-graphite-800 transition-colors truncate"
              title="Review Issues & Code Smells"
            >
              🛡️ Issues
            </Link>

            <Link
              to="/dashboard/tests"
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-mist-300 hover:text-emerald-300 hover:border-emerald-400/40 hover:bg-graphite-800 transition-colors truncate"
              title="Generate unit test suites"
            >
              🧪 Tests
            </Link>

            <Link
              to="/dashboard/pull-requests"
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-mist-300 hover:text-indigo-300 hover:border-indigo-400/40 hover:bg-graphite-800 transition-colors truncate"
              title="Open GitHub Pull Requests"
            >
              🔀 PRs
            </Link>

            <Link
              to={`/dashboard/repositories/${repo.repositoryId}/analysis`}
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2 py-1.5 text-center text-[11px] font-mono font-medium text-mist-300 hover:text-amber-400 hover:border-amber-400/40 hover:bg-graphite-800 transition-colors truncate"
              title="Full Analysis Report"
            >
              📊 Report
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
