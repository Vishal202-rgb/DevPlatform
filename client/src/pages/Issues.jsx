import { useEffect, useState } from 'react';
import IssueList from '../components/IssueList';
import EmptyState from '../components/EmptyState';
import { IssueRowSkeleton } from '../components/Skeleton';
import { fetchAllIssues } from '../services/analysisService';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIssues = () => {
    setIsLoading(true);
    setError('');
    fetchAllIssues()
      .then(setIssues)
      .catch((err) => setError(err.message || 'Failed to load issues.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadIssues();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
            Issues &amp; Vulnerabilities
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Unified view of active security findings, bugs, and performance debts across all analyzed repositories.
          </p>
        </div>

        <button
          onClick={loadIssues}
          disabled={isLoading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:bg-graphite-700 hover:text-mist-100 disabled:opacity-50"
        >
          <span className={isLoading ? 'animate-spin' : ''}>⟳</span>
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={loadIssues}
            className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <IssueRowSkeleton key={i} />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon="🛡"
          title="No open issues detected"
          description="Either no repositories have been analyzed yet, or all your codebase scans came back 100% clean."
          actionLabel="Scan a Repository"
          actionLink="/dashboard/repositories"
        />
      ) : (
        <IssueList issues={issues} />
      )}
    </div>
  );
}