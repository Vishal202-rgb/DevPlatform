import { Link } from 'react-router-dom';

const languageColors = {
  JavaScript: '#F5B942',
  TypeScript: '#5B9BD5',
  Python: '#7FB069',
  Go: '#5FC9D6',
  Rust: '#D97757',
  Java: '#E8A33D',
  Ruby: '#D46A6A',
};

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

export default function RepositoryCard({ repo, onConnect, isConnecting, onAnalyze, isAnalyzing }) {
    const dotColor = languageColors[repo.language] || '#84848C';

  return (
    <div className="flex flex-col justify-between rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-panel">
      <div>
        <div className="flex items-start justify-between gap-2">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm font-semibold text-mist-100 hover:text-amber-400"
          >
            {repo.fullName}
          </a>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              repo.private
                ? 'bg-graphite-700 text-mist-300'
                : 'bg-amber-400/10 text-amber-400'
            }`}
          >
            {repo.private ? 'Private' : 'Public'}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-mist-500">
          {repo.description || 'No description provided.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-mist-500">
          {repo.language && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
              {repo.language}
            </span>
          )}
          <span>★ {repo.stars}</span>
          <span>⑂ {repo.forks}</span>
          <span>Updated {timeAgo(repo.updatedAt)}</span>
        </div>

        {repo.hasAnalysis && (
          <Link
            to={`/dashboard/repositories/${repo.repositoryId}/analysis`}
            className="mt-3 inline-block text-xs text-amber-400 hover:underline"
          >
            View last analysis →
          </Link>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => onConnect(repo.githubId)}
          disabled={repo.connected || isConnecting}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            repo.connected
              ? 'cursor-default bg-graphite-800 text-mist-500'
              : 'bg-graphite-700 text-mist-100 hover:bg-graphite-600'
          } disabled:opacity-60`}
        >
          {repo.connected ? 'Connected ✓' : isConnecting ? 'Connecting…' : 'Connect repository'}
        </button>
        <button
          onClick={() => onAnalyze(repo)}
          disabled={isAnalyzing}
          className="flex-1 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAnalyzing ? 'Starting…' : 'Analyze repository'}
        </button>
      </div>
    </div>
  );
}
