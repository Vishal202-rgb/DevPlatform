import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ScoreGauge from '../components/ScoreGauge';
import SeveritySummary from '../components/SeveritySummary';
import IssueList from '../components/IssueList';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import {
  runAnalysis,
  fetchLatestAnalysis,
  fetchAnalysisStatus,
  shareAnalysis,
  unshareAnalysis,
} from '../services/analysisService';

export default function AnalysisResult() {
  const { repositoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const autorun = searchParams.get('autorun') === '1';
  const toast = useToast();

  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Analyzing repository with Gemini…');
  const [statusSubtext, setStatusSubtext] = useState(
    'Fetching repository AST from GitHub and scanning for security vulnerabilities, logic bugs, performance bottlenecks, and architectural code smells.'
  );
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeSeverityFilter, setActiveSeverityFilter] = useState('all');

  // Guards against concurrent calls and React StrictMode double-execution
  const inProgressRef = useRef(false);
  const hasAutoRunRef = useRef(false);
  const pollIntervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Polls backend until active analysis job is finished, then updates state
  const pollUntilComplete = useCallback(() => {
    stopPolling();

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusData = await fetchAnalysisStatus(repositoryId);
        if (statusData?.isRunning) {
          setIsRunning(true);
          if (statusData.message) setStatusMessage(statusData.message);
          if (statusData.stage === 'retrying') {
            setStatusSubtext('The AI model is experiencing high demand. Backing off and retrying automatically…');
          } else if (statusData.stage === 'fallback') {
            setStatusSubtext('Switching to configured fallback model to complete the code review…');
          } else if (statusData.stage === 'fetching') {
            setStatusSubtext('Fetching repository source tree and analyzing file contents from GitHub…');
          }
        } else {
          // Analysis is done on the backend
          stopPolling();
          try {
            const data = await fetchLatestAnalysis(repositoryId);
            if (data?.status === 'failed') {
              const failMsg = data.error || 'AI analysis encountered an issue.';
              setError(failMsg);
              setAnalysis(null);
              toast.error(failMsg, 'Scan Error');
            } else {
              setAnalysis(data);
              setNotFound(false);
              setError('');
            }
          } catch (err) {
            if (err.response?.status === 404) {
              setNotFound(true);
            } else {
              setError(err.response?.data?.message || err.message || 'Analysis could not be loaded.');
            }
          } finally {
            setIsRunning(false);
            setIsLoading(false);
            inProgressRef.current = false;
          }
        }
      } catch {
        // Transient polling error, continue
      }
    }, 1500);
  }, [repositoryId, stopPolling, toast]);

  const handleRun = useCallback(async () => {
    // Prevent duplicate simultaneous requests
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    // Reset error state and clear any existing toasts
    setError('');
    toast.clear?.();
    setIsRunning(true);
    setIsLoading(false);
    setStatusMessage('Starting repository analysis…');
    setStatusSubtext(
      'Fetching repository AST from GitHub and scanning for security vulnerabilities, logic bugs, performance bottlenecks, and architectural code smells.'
    );

    // Start background status poller
    pollUntilComplete();

    try {
      const data = await runAnalysis(repositoryId);
      stopPolling();
      if (data?.status === 'failed') {
        const failMsg = data.error || 'AI analysis failed.';
        setError(failMsg);
        setAnalysis(null);
        setIsRunning(false);
        toast.error(failMsg, 'Scan Error');
      } else {
        setAnalysis(data);
        setNotFound(false);
        setError('');
        setIsRunning(false);
        toast.success('Code analysis completed successfully!', 'Analysis Finished');
      }
    } catch (err) {
      // If 409, an analysis is ALREADY genuinely running on the backend
      if (err.response?.status === 409) {
        // Do not fail or show error toast; attach to the active running job and continue polling
        setError('');
        setIsRunning(true);
        setStatusMessage('An analysis is already in progress. Waiting for completion…');
        pollUntilComplete();
        return;
      }

      // Real error occurred
      stopPolling();
      setIsRunning(false);

      const serverMessage = err.response?.data?.message || err.message;
      let displayMessage = serverMessage;
      if (
        serverMessage?.includes('high demand') ||
        serverMessage?.includes('temporarily') ||
        serverMessage?.includes('unavailable') ||
        err.response?.status === 503 ||
        err.response?.status === 429
      ) {
        displayMessage = 'The AI model is temporarily experiencing high demand. Please click "Try Again" in a moment.';
      } else if (!displayMessage) {
        displayMessage = 'AI analysis encountered an issue. Please try again.';
      }
      setError(displayMessage);
      toast.error(displayMessage, 'Scan Error');
    } finally {
      inProgressRef.current = false;
    }
  }, [repositoryId, pollUntilComplete, stopPolling, toast]);

  // Initial load and status verification
  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError('');

      try {
        // 1. Verify if an analysis is currently running on the server
        const statusData = await fetchAnalysisStatus(repositoryId);
        if (isCancelled) return;

        if (statusData?.isRunning) {
          setIsRunning(true);
          setIsLoading(false);
          setStatusMessage(statusData.message || 'Analyzing repository with Gemini…');
          pollUntilComplete();
          return;
        }

        // 2. If autorun requested and hasn't run yet in this session
        if (autorun && !hasAutoRunRef.current) {
          hasAutoRunRef.current = true;
          const next = new URLSearchParams(window.location.search);
          next.delete('autorun');
          setSearchParams(next, { replace: true });
          handleRun();
          return;
        }

        // 3. Otherwise fetch latest analysis
        try {
          const data = await fetchLatestAnalysis(repositoryId);
          if (!isCancelled) {
            if (data?.status === 'failed') {
              setError(data.error || 'The previous analysis failed.');
              setAnalysis(null);
              setNotFound(false);
            } else {
              setAnalysis(data);
              setNotFound(false);
              setError('');
            }
          }
        } catch (err) {
          if (!isCancelled) {
            if (err.response?.status === 404) {
              setNotFound(true);
            } else {
              setError(err.response?.data?.message || err.message || 'Failed to load analysis.');
            }
          }
        }
      } catch {
        // Fallback to loading latest
        try {
          const data = await fetchLatestAnalysis(repositoryId);
          if (!isCancelled) {
            if (data?.status === 'failed') {
              setError(data.error || 'The previous analysis failed.');
              setAnalysis(null);
              setNotFound(false);
            } else {
              setAnalysis(data);
              setNotFound(false);
            }
          }
        } catch (err) {
          if (!isCancelled) {
            if (err.response?.status === 404) {
              setNotFound(true);
            } else {
              setError(err.response?.data?.message || err.message || 'Failed to load analysis.');
            }
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isCancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryId]);

  // Update shareUrl when analysis loads
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
      toast.success('Public share link generated.', 'Sharing Enabled');
    } catch (err) {
      const msg = err.message || 'Failed to enable sharing.';
      setShareError(msg);
      toast.error(msg, 'Share Failed');
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
      toast.info('Public share link has been revoked.', 'Sharing Disabled');
    } catch (err) {
      const msg = err.message || 'Failed to disable sharing.';
      setShareError(msg);
      toast.error(msg, 'Revoke Failed');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Share link copied to clipboard.', 'Copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError('Could not copy automatically - please copy manually.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
              Code Analysis Report
            </h1>
            {analysis?.model && (
              <span className="rounded-full border border-graphite-700 bg-graphite-800 px-2 py-0.5 text-[10px] font-mono text-mist-400">
                {analysis.model}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Automated AST code review with vulnerability detection and automated refactoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/repositories"
            className="text-xs font-mono text-mist-400 hover:text-amber-400 transition-colors"
          >
            ← Back to repositories
          </Link>
        </div>
      </div>

      {/* Error notification banner */}
      {error && !isRunning && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="self-start sm:self-auto rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:opacity-50 shadow-sm active:scale-95"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Running State */}
      {isRunning ? (
        <div className="rounded-xl border border-graphite-700 bg-graphite-900/90 p-10 text-center shadow-panel animate-fade-in space-y-4">
          <div className="relative mx-auto h-12 w-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
            <span className="text-lg">⚡</span>
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-amber-400">{statusMessage}</p>
            <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-mist-400 leading-relaxed">
              {statusSubtext}
            </p>
          </div>
          <div className="w-48 mx-auto h-1 rounded-full bg-graphite-800 overflow-hidden">
            <div className="h-full bg-amber-400 animate-pulse w-full" />
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="h-44 rounded-xl skeleton-shimmer" />
          <div className="h-64 rounded-xl skeleton-shimmer" />
        </div>
      ) : notFound ? (
        <EmptyState
          icon="⚡"
          title="No analysis run yet for this repository"
          description="Initiate an automated AI code audit to scan for vulnerabilities, bugs, code smells, and performance regressions."
          actionLabel="Run First Analysis"
          onAction={handleRun}
        />
      ) : analysis ? (
        <div className="space-y-6 animate-fade-in">
          {/* Overview Hero Card: Gauge + Meta + Share */}
          <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 p-6 shadow-panel">
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
              {/* Score Gauge */}
              <div className="shrink-0 p-2">
                <ScoreGauge score={analysis.overallScore ?? 0} />
              </div>

              {/* Center & Right metadata */}
              <div className="flex-1 w-full space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-graphite-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-mist-100">
                        {analysis.filesAnalyzed || 0} source file{analysis.filesAnalyzed === 1 ? '' : 's'} reviewed
                      </span>
                      <span className="rounded-full bg-graphite-800 px-2 py-0.5 text-[10px] font-mono text-mist-400 border border-graphite-700">
                        {analysis.issues?.length || 0} issues
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-mist-500 font-mono">
                      Completed {new Date(analysis.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRun}
                      disabled={isRunning}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-600 bg-graphite-800 px-3.5 py-1.5 text-xs font-semibold text-mist-100 transition-colors hover:border-amber-400/50 hover:text-amber-400 disabled:opacity-50 active:scale-95"
                    >
                      <span>⟳</span>
                      <span>Re-run Analysis</span>
                    </button>
                  </div>
                </div>

                {/* Severity Breakdown Cards */}
                <div>
                  <p className="mb-2 text-[11px] font-mono font-medium uppercase tracking-wider text-mist-400">
                    Severity Distribution (Click to filter)
                  </p>
                  <SeveritySummary
                    summary={analysis.summary}
                    activeSeverity={activeSeverityFilter}
                    onSelectSeverity={setActiveSeverityFilter}
                  />
                </div>

                {/* Public Share Panel */}
                <div className="border-t border-graphite-800/80 pt-4">
                  {shareUrl ? (
                    <div className="space-y-2 rounded-xl border border-graphite-700/80 bg-graphite-950/60 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">
                          Public Share Link Enabled
                        </span>
                        <span className="text-[10px] text-mist-500">Read-only view</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          readOnly
                          value={shareUrl}
                          onFocus={(e) => e.target.select()}
                          className="min-w-0 flex-1 rounded-lg border border-graphite-700 bg-graphite-900 px-3 py-1.5 font-mono text-xs text-mist-200 outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 shadow-sm"
                        >
                          {copied ? 'Copied ✓' : 'Copy Link'}
                        </button>
                        <button
                          onClick={handleUnshare}
                          disabled={isSharing}
                          className="rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs text-mist-400 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                        >
                          {isSharing ? 'Revoking…' : 'Revoke'}
                        </button>
                      </div>

                      <p className="text-[11px] text-mist-500">
                        Anyone with this link can view this code report without logging in. Fix actions remain protected.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-mist-200">Share this report</p>
                        <p className="text-[11px] text-mist-500">
                          Create a public, view-only URL to share findings with team members or clients.
                        </p>
                      </div>
                      <button
                        onClick={handleShare}
                        disabled={isSharing}
                        className="rounded-lg border border-graphite-600 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-mist-200 transition-colors hover:border-amber-400/50 hover:text-amber-400 disabled:opacity-50"
                      >
                        {isSharing ? 'Generating Link…' : 'Create Share Link'}
                      </button>
                    </div>
                  )}
                  {shareError && (
                    <p className="mt-2 text-xs text-red-400 font-mono">{shareError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Issue Details Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
                Detected Issues &amp; AI Recommendations
              </h2>
              {activeSeverityFilter !== 'all' && (
                <button
                  onClick={() => setActiveSeverityFilter('all')}
                  className="text-xs font-mono text-amber-400 hover:underline"
                >
                  Show all severities
                </button>
              )}
            </div>

            <IssueList
              issues={analysis.issues || []}
              analysisId={analysis._id}
              activeFilter={activeSeverityFilter}
              onFilterChange={setActiveSeverityFilter}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}