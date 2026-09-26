import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHealthCheck } from '../services/systemService';
import { useToast } from '../hooks/useToast';

const statusConfig = {
  ok: {
    icon: '✓',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    label: 'Passed',
    dot: 'bg-emerald-400',
  },
  warning: {
    icon: '⚠',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    label: 'Warning',
    dot: 'bg-amber-400',
  },
  error: {
    icon: '✕',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Failure',
    dot: 'bg-red-400',
  },
};

function CheckRow({ check }) {
  const cfg = statusConfig[check.status] || statusConfig.warning;

  return (
    <div className="flex items-start gap-3.5 p-4 transition-colors hover:bg-graphite-850/40">
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}
      >
        {cfg.icon}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs sm:text-sm font-semibold text-mist-100 font-mono">
            {check.label}
          </p>
          <span
            className={`rounded-full px-2 py-0.2 text-[10px] font-mono font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}
          >
            {cfg.label}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-mist-300 leading-relaxed">
          {check.message}
        </p>

        {check.hint && (
          <div className="mt-2 rounded-lg border border-graphite-750 bg-graphite-950/60 p-2.5 font-mono text-[11px] text-amber-300/80">
            <span className="font-semibold text-mist-400">Resolution:</span> {check.hint}
          </div>
        )}
      </div>
    </div>
  );
}

const overallBanner = {
  ok: {
    title: 'Platform Infrastructure Healthy',
    text: 'All environment variables, database connections, and AI API endpoints are operational.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  warning: {
    title: 'Configuration Notice',
    text: 'Core services are functional, but optional services or fallback models require attention.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  error: {
    title: 'Configuration Issues Detected',
    text: 'Critical services are misconfigured. Review the failing checks below.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
  },
};

export default function SystemHealth() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchHealthCheck();
      setResult(data);
      toastRef.current.success('Diagnostics scan complete.', 'System Check');
    } catch (err) {
      const msg = err.message || 'Failed to run diagnostics.';
      setError(msg);
      toastRef.current.error(msg, 'Diagnostics Failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const banner = result ? overallBanner[result.overallStatus] || overallBanner.warning : null;
  const erroredChecks = result?.checks.filter((c) => c.status === 'error') || [];
  const warningChecks = result?.checks.filter((c) => c.status === 'warning') || [];
  const okChecks = result?.checks.filter((c) => c.status === 'ok') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
            Deployment Diagnostics
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400 max-w-2xl">
            Live infrastructure diagnostics verifying MongoDB latency, GitHub OAuth credentials, Gemini API connectivity, and environment variables.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={runChecks}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:opacity-50 shadow-sm"
          >
            <span className={isLoading ? 'animate-spin' : ''}>⟳</span>
            <span>{isLoading ? 'Checking…' : 'Re-run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs sm:text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={runChecks}
            className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && !result ? (
        <div className="space-y-4">
          <div className="h-28 rounded-xl skeleton-shimmer" />
          <div className="h-64 rounded-xl skeleton-shimmer" />
        </div>
      ) : result ? (
        <div className="space-y-6 animate-fade-in">
          {/* Status Hero Card */}
          <div
            className={`rounded-xl border p-5 sm:p-6 shadow-panel ${banner.border} ${banner.bg}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${banner.dot} animate-pulse`} />
                  <h2 className="text-base sm:text-lg font-bold text-mist-100">
                    {banner.title}
                  </h2>
                </div>
                <p className={`text-xs sm:text-sm ${banner.color}`}>
                  {banner.text}
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-3 font-mono text-xs text-mist-300">
                <span className="rounded-lg bg-graphite-900/80 px-2.5 py-1 border border-graphite-700">
                  {okChecks.length} Passed
                </span>
                {warningChecks.length > 0 && (
                  <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 border border-amber-500/30 text-amber-300">
                    {warningChecks.length} Warnings
                  </span>
                )}
                {erroredChecks.length > 0 && (
                  <span className="rounded-lg bg-red-500/20 px-2.5 py-1 border border-red-500/30 text-red-300">
                    {erroredChecks.length} Failures
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Errors group */}
          {erroredChecks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-red-500/30 bg-graphite-900 shadow-panel">
              <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2.5 flex items-center justify-between font-mono text-xs text-red-400 font-semibold uppercase tracking-wider">
                <span>System Failures ({erroredChecks.length})</span>
                <span>Immediate Action Required</span>
              </div>
              <div className="divide-y divide-graphite-700/60">
                {erroredChecks.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </div>
            </div>
          )}

          {/* Warnings group */}
          {warningChecks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-graphite-900 shadow-panel">
              <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 flex items-center justify-between font-mono text-xs text-amber-400 font-semibold uppercase tracking-wider">
                <span>Warnings &amp; Notices ({warningChecks.length})</span>
                <span>Recommended Review</span>
              </div>
              <div className="divide-y divide-graphite-700/60">
                {warningChecks.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </div>
            </div>
          )}

          {/* Passing group */}
          {okChecks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
              <div className="border-b border-graphite-700 bg-graphite-800/80 px-4 py-2.5 flex items-center justify-between font-mono text-xs text-mist-400 font-semibold uppercase tracking-wider">
                <span>Operational Validations ({okChecks.length})</span>
                <span className="text-emerald-400">All Passed ✓</span>
              </div>
              <div className="divide-y divide-graphite-700/60">
                {okChecks.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-graphite-750 bg-graphite-900/60 p-4 text-xs font-mono text-mist-500">
            <div>
              <span>Runtime: </span>
              <span className="text-mist-300">
                {result.meta?.vercelEnv ? `Vercel (${result.meta.vercelEnv})` : 'Node.js Standalone'}
              </span>
              <span className="mx-2">·</span>
              <span>NODE_ENV: </span>
              <span className="text-mist-300">{result.meta?.nodeEnv || 'development'}</span>
            </div>
            <div>
              <span>Checked: </span>
              <span className="text-mist-300">
                {new Date(result.meta?.checkedAt || Date.now()).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}