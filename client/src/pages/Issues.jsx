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
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Code Quality</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Security Findings &amp; Debts</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Issues &amp; Vulnerabilities
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Unified view of active security findings, bugs, and performance debts across all analyzed repositories.
          </p>
        </div>

        <button
          onClick={loadIssues}
          disabled={isLoading}
          className="self-start sm:self-auto btn-secondary !text-xs !py-2 !px-3.5"
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
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 font-mono animate-fade-in">
          <span>{error}</span>
          <button
            onClick={loadIssues}
            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
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
          icon={
            <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          }
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