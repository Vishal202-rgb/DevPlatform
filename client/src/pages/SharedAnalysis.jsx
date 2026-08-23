import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ScoreGauge from '../components/ScoreGauge';
import SeveritySummary from '../components/SeveritySummary';
import IssueList from '../components/IssueList';
import { fetchSharedReport } from '../services/analysisService';

// Standalone public page - deliberately NOT wrapped in the dashboard layout
// or ProtectedRoute. No auth required, no sidebar/navbar, no repository
// context. Rendered at /share/:shareToken for anyone with the link.
export default function SharedAnalysis() {
  const { shareToken } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSharedReport(shareToken)
      .then(setReport)
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? 'This share link is invalid or has been revoked.'
            : err.message || 'Failed to load this report.'
        );
      })
      .finally(() => setIsLoading(false));
  }, [shareToken]);

  return (
    <div className="min-h-screen bg-graphite-950 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400 font-mono text-sm font-bold text-graphite-950">
            Dv
          </div>
          <span className="font-mono text-sm font-semibold tracking-tight text-mist-100">
            devplatform
          </span>
          <span className="ml-2 rounded-full bg-graphite-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500">
            Shared report - read only
          </span>
        </div>

        {isLoading ? (
          <p className="font-mono text-sm text-mist-500">Loading report…</p>
        ) : error ? (
          <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        ) : report ? (
          <div>
            <h1 className="mb-1 text-xl font-semibold text-mist-100">{report.repositoryName}</h1>
            <p className="mb-6 text-sm text-mist-500">
              AI-powered code review, run by Gemini{' '}
              <span className="font-mono">{report.model}</span> on{' '}
              {new Date(report.createdAt).toLocaleString()}.
            </p>

            <div className="mb-6 flex flex-col items-center gap-6 rounded-xl border border-graphite-700 bg-graphite-900 p-6 shadow-panel sm:flex-row sm:items-start">
              <ScoreGauge score={report.overallScore ?? 0} />
              <div className="flex-1">
                <p className="text-sm text-mist-100">
                  {report.filesAnalyzed} file{report.filesAnalyzed === 1 ? '' : 's'} analyzed
                </p>
                <div className="mt-4">
                  <SeveritySummary summary={report.summary} />
                </div>
              </div>
            </div>

            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mist-500">
              Issue details &amp; recommendations
            </h2>
            <IssueList issues={report.issues || []} readOnly />
          </div>
        ) : null}

        <p className="mt-10 text-center text-xs text-mist-500">
          Generated with devplatform - AI-powered code review.
        </p>
      </div>
    </div>
  );
}