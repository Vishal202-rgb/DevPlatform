import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ScoreGauge from '../components/ScoreGauge';
import SeveritySummary from '../components/SeveritySummary';
import IssueList from '../components/IssueList';
import EmptyState from '../components/EmptyState';
import { fetchSharedReport } from '../services/analysisService';

export default function SharedAnalysis() {
  const { shareToken } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSeverity, setActiveSeverity] = useState('all');

  useEffect(() => {
    fetchSharedReport(shareToken)
      .then(setReport)
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? 'This share link has expired, been revoked, or is invalid.'
            : err.message || 'Failed to load this audit report.'
        );
      })
      .finally(() => setIsLoading(false));
  }, [shareToken]);

  return (
    <div className="min-h-screen bg-graphite-950 px-4 py-8 sm:px-8 text-mist-100 selection:bg-amber-400/20 selection:text-amber-300">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Brand Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-graphite-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 font-mono text-sm font-bold text-graphite-950 shadow-glow-sm">
              Dv
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
                  DevPlatform
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                  Verified Audit
                </span>
              </div>
              <p className="text-[11px] text-mist-500 font-mono">Public Code Review Report</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-graphite-700 bg-graphite-900 px-3 py-1.5 text-xs font-mono text-mist-400">
              Read-Only View
            </span>
            <Link
              to="/login"
              className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 hover:bg-amber-500 transition-colors shadow-sm"
            >
              Sign In to DevPlatform
            </Link>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            <div className="h-44 rounded-xl skeleton-shimmer" />
            <div className="h-64 rounded-xl skeleton-shimmer" />
          </div>
        ) : error ? (
          <EmptyState
            icon="🔒"
            title="Unable to Access Shared Report"
            description={error}
            actionLabel="Go to DevPlatform"
            actionLink="/login"
            isError
          />
        ) : report ? (
          <main className="space-y-6 animate-fade-in">
            {/* Repository Info Title */}
            <div className="rounded-xl border border-graphite-700 bg-graphite-900 p-6 shadow-panel">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    Repository Audit
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1 font-mono">
                    {report.repositoryName}
                  </h1>
                  <p className="mt-1.5 text-xs text-mist-400 font-mono">
                    Scanned using Gemini <span className="text-mist-200">{report.model}</span> on{' '}
                    {new Date(report.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <div className="rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 font-mono text-xs text-mist-300">
                  {report.filesAnalyzed} files analyzed
                </div>
              </div>

              {/* Gauge & Breakdown */}
              <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start border-t border-graphite-800 pt-6">
                <ScoreGauge score={report.overallScore ?? 0} />
                <div className="flex-1 w-full space-y-3">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-mist-500">
                    Severity Breakdown
                  </p>
                  <SeveritySummary
                    summary={report.summary}
                    activeSeverity={activeSeverity}
                    onSelectSeverity={setActiveSeverity}
                  />
                </div>
              </div>
            </div>

            {/* Issue List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
                  Audit Findings &amp; Remediations ({report.issues?.length || 0})
                </h2>
                {activeSeverity !== 'all' && (
                  <button
                    onClick={() => setActiveSeverity('all')}
                    className="text-xs font-mono text-amber-400 hover:underline"
                  >
                    Reset filter
                  </button>
                )}
              </div>

              <IssueList
                issues={report.issues || []}
                readOnly
                activeFilter={activeSeverity}
                onFilterChange={setActiveSeverity}
              />
            </div>
          </main>
        ) : null}

        {/* Footer */}
        <footer className="pt-8 pb-4 text-center text-xs font-mono text-mist-500 border-t border-graphite-800/80">
          <p>
            Generated with <span className="text-mist-200 font-semibold">DevPlatform</span> — AI Developer Productivity Suite.
          </p>
        </footer>
      </div>
    </div>
  );
}