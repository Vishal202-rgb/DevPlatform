import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ScoreGauge from '../components/ScoreGauge';
import SeveritySummary from '../components/SeveritySummary';
import IssueList from '../components/IssueList';
import {
  runAnalysis,
  fetchLatestAnalysis,
  shareAnalysis,
  unshareAnalysis,
} from '../services/analysisService';

export default function AnalysisResult() {
  const { repositoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const autorun = searchParams.get('autorun') === '1';

  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);

  const loadLatest = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setNotFound(false);
    try {
      const data = await fetchLatestAnalysis(repositoryId);
      setAnalysis(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.message || 'Failed to load analysis.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [repositoryId]);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError('');
    try {
      const data = await runAnalysis(repositoryId);
      setAnalysis(data);
      setNotFound(false);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setIsRunning(false);
      setIsLoading(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    if (autorun) {
      const next = new URLSearchParams(searchParams);
      next.delete('autorun');
      setSearchParams(next, { replace: true });
      handleRun();
    } else {
      loadLatest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect whether this analysis is already shared as soon as it loads,
  // without a separate round trip - the owner-facing analysis object
  // already includes shareToken.
  useEffect(() => {
    if (analysis?.shareToken) {
      setShareUrl(`${window.location.origin}/share/${analysis.shareToken}`);
    } else {
      setShareUrl('');
    }
  }, [analysis]);

  const handleShare = async () => {
    setIsSharing(true);
    setShareError('');
    try {
      const result = await shareAnalysis(analysis._id);
      setShareUrl(result.shareUrl);
    } catch (err) {
      setShareError(err.message || 'Failed to enable sharing.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async () => {
    setIsSharing(true);
    setShareError('');
    try {
      await unshareAnalysis(analysis._id);
      setShareUrl('');
    } catch (err) {
      setShareError(err.message || 'Failed to disable sharing.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setShareError('Could not copy automatically - copy the link manually.');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Analysis</h1>
          <p className="mt-1 text-sm text-mist-500">
            AI-powered code review, run by Gemini{' '}
            <span className="font-mono">{analysis?.model || 'gemini'}</span>.
          </p>
        </div>
        <Link to="/dashboard/repositories" className="text-sm text-mist-500 hover:text-amber-400">
          ← Back to repositories
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {isRunning ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <span className="mb-3 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
          <p className="font-mono text-sm text-amber-400">Running Gemini analysis…</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
            Fetching source files from GitHub and reviewing them for bugs, security issues, code
            smells, and performance problems. This can take a moment on larger repositories.
          </p>
        </div>
      ) : isLoading ? (
        <p className="font-mono text-sm text-mist-500">Loading…</p>
      ) : notFound ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="font-mono text-sm text-amber-400">No analysis yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
            Run Gemini analysis to detect bugs, security issues, code smells, and performance
            problems in this repository.
          </p>
          <button
            onClick={handleRun}
            className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
          >
            Run analysis
          </button>
        </div>
      ) : analysis ? (
        <div>
          <div className="mb-6 flex flex-col items-center gap-6 rounded-xl border border-graphite-700 bg-graphite-900 p-6 shadow-panel sm:flex-row sm:items-start">
            <ScoreGauge score={analysis.overallScore ?? 0} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-mist-100">
                    {analysis.filesAnalyzed} file{analysis.filesAnalyzed === 1 ? '' : 's'} analyzed
                  </p>
                  <p className="mt-0.5 text-xs text-mist-500">
                    Last run {new Date(analysis.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={handleRun}
                  className="rounded-lg border border-graphite-600 px-4 py-2 text-sm text-mist-100 transition-colors hover:border-amber-400/50 hover:text-amber-400"
                >
                  Re-run analysis
                </button>
              </div>
              <div className="mt-4">
                <SeveritySummary summary={analysis.summary} />
              </div>

              <div className="mt-4 border-t border-graphite-800 pt-4">
                {shareUrl ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">
                      Public share link
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        readOnly
                        value={shareUrl}
                        onFocus={(e) => e.target.select()}
                        className="min-w-0 flex-1 rounded-lg border border-graphite-600 bg-graphite-800 px-3 py-1.5 font-mono text-xs text-mist-100 outline-none"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
                      >
                        {copied ? 'Copied ✓' : 'Copy'}
                      </button>
                      <button
                        onClick={handleUnshare}
                        disabled={isSharing}
                        className="rounded-lg border border-graphite-600 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:border-red-500/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSharing ? 'Stopping…' : 'Stop sharing'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-mist-500">
                      Anyone with this link can view this report - no login needed, and they
                      can't trigger analyses or fixes.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className="rounded-lg border border-graphite-600 px-4 py-2 text-sm text-mist-100 transition-colors hover:border-amber-400/50 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSharing ? 'Generating link…' : 'Share report'}
                  </button>
                )}
                {shareError && <p className="mt-2 text-xs text-red-400">{shareError}</p>}
              </div>
            </div>
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-mist-500">
            Issue details &amp; recommendations
          </h2>
          <IssueList issues={analysis.issues || []} analysisId={analysis._id} />
        </div>
      ) : null}
    </div>
  );
}