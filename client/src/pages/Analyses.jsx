import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { TableRowSkeleton } from '../components/Skeleton';
import { fetchAllAnalyses } from '../services/analysisService';

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-mist-500 bg-graphite-800';
  if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
}

export default function Analyses() {
  const [analyses, setAnalyses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalyses = () => {
    setIsLoading(true);
    setError('');
    fetchAllAnalyses()
      .then(setAnalyses)
      .catch((err) => setError(err.message || 'Failed to load analyses.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
            Analyses History
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Chronological audit log of all Gemini automated code reviews across your repositories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/repositories"
            className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 shadow-sm"
          >
            Scan Repository +
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={loadAnalyses}
            className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-graphite-700 bg-graphite-800/80 font-mono text-[11px] uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-4 py-3">Repository</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Critical</th>
                <th className="px-4 py-3">High</th>
                <th className="px-4 py-3">Run Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={7} />
              ))}
            </tbody>
          </table>
        </div>
      ) : analyses.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No analyses conducted yet"
          description="Your code reviews will be logged here once you execute an analysis on any connected repository."
          actionLabel="Select a Repository"
          actionLink="/dashboard/repositories"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
          <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
            <thead className="border-b border-graphite-700 bg-graphite-800/80 font-mono text-[11px] uppercase tracking-wider text-mist-400">
              <tr>
                <th className="px-4 py-3.5">Repository</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Health Score</th>
                <th className="px-4 py-3.5">Critical</th>
                <th className="px-4 py-3.5">High</th>
                <th className="px-4 py-3.5">Medium</th>
                <th className="px-4 py-3.5">Low</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-700/60 font-mono">
              {analyses.map((a) => (
                <tr
                  key={a._id}
                  className="hover:bg-graphite-850/50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    {a.repository ? (
                      <Link
                        to={`/dashboard/repositories/${a.repository._id}/analysis`}
                        className="font-semibold text-mist-100 hover:text-amber-400 transition-colors"
                      >
                        {a.repository.fullName}
                      </Link>
                    ) : (
                      <span className="text-mist-500">Deleted Repository</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        a.status === 'completed'
                          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border border-red-500/20 bg-red-500/10 text-red-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${a.status === 'completed' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold border ${scoreColor(a.overallScore)}`}>
                      {a.overallScore !== null && a.overallScore !== undefined ? a.overallScore : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-red-400">
                    {a.summary?.critical ?? 0}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-orange-400">
                    {a.summary?.high ?? 0}
                  </td>
                  <td className="px-4 py-3.5 text-amber-400">
                    {a.summary?.medium ?? 0}
                  </td>
                  <td className="px-4 py-3.5 text-sky-400">
                    {a.summary?.low ?? 0}
                  </td>
                  <td className="px-4 py-3.5 text-mist-400 font-sans text-xs">
                    {new Date(a.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-sans">
                    {a.repository && (
                      <Link
                        to={`/dashboard/repositories/${a.repository._id}/analysis`}
                        className="rounded-lg border border-graphite-700 bg-graphite-800 px-2.5 py-1 text-xs font-medium text-mist-200 hover:border-amber-400/50 hover:text-amber-400 transition-colors"
                      >
                        View Report →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}