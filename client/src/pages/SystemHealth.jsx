import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchHealthCheck } from '../services/systemService';

const statusConfig = {
  ok: { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'OK' },
  warning: { icon: '!', color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Warning' },
  error: { icon: '✕', color: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' },
};

function StatusPill({ status }) {
  const cfg = statusConfig[status] || statusConfig.warning;
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cfg.bg} ${cfg.color}`}
    >
      {cfg.icon}
    </span>
  );
}

function CheckRow({ check }) {
  const cfg = statusConfig[check.status] || statusConfig.warning;
  return (
    <div className="flex items-start gap-3 border-b border-graphite-800 px-4 py-3 last:border-0">
      <StatusPill status={check.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-medium text-mist-100">{check.label}</p>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
        </div>
        <p className="mt-0.5 text-sm text-mist-300">{check.message}</p>
        {check.hint && <p className="mt-1 text-xs text-mist-500">{check.hint}</p>}
      </div>
    </div>
  );
}

const overallBanner = {
  ok: { text: 'Everything looks correctly configured.', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  warning: { text: 'Configured, but a few things are worth a look.', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' },
  error: { text: 'Something is misconfigured - see the errors below.', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

export default function SystemHealth() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const runChecks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchHealthCheck();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to run diagnostics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  const banner = result ? overallBanner[result.overallStatus] : null;
  const erroredChecks = result?.checks.filter((c) => c.status === 'error') || [];
  const warningChecks = result?.checks.filter((c) => c.status === 'warning') || [];
  const okChecks = result?.checks.filter((c) => c.status === 'ok') || [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Deployment diagnostics</h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-500">
            Checks for the kind of environment-variable and config mismatches that don't crash
            the app outright but cause confusing failures (OAuth redirects, CORS, deprecated
            model names). If this page loaded, the server already started successfully - a
            totally broken <code className="font-mono text-mist-300">MONGO_URI</code> would
            prevent the app from starting at all, before this page could ever render.
          </p>
        </div>
        <Link to="/dashboard" className="shrink-0 text-sm text-mist-500 hover:text-amber-400">
          ← Back to overview
        </Link>
      </div>

      <button
        onClick={runChecks}
        disabled={isLoading}
        className="mb-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Checking…' : 'Re-run checks'}
      </button>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {isLoading && !result ? (
        <p className="font-mono text-sm text-mist-500">Running checks…</p>
      ) : result ? (
        <div>
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${banner.bg} ${banner.color}`}>
            {banner.text}
          </div>

          {erroredChecks.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
              <p className="border-b border-graphite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-400">
                Errors ({erroredChecks.length})
              </p>
              {erroredChecks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
          )}

          {warningChecks.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
              <p className="border-b border-graphite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
                Warnings ({warningChecks.length})
              </p>
              {warningChecks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
          )}

          {okChecks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
              <p className="border-b border-graphite-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
                Passing ({okChecks.length})
              </p>
              {okChecks.map((c) => (
                <CheckRow key={c.id} check={c} />
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-mist-500">
            Environment: {result.meta.vercelEnv ? `Vercel (${result.meta.vercelEnv})` : 'not Vercel'} · NODE_ENV:{' '}
            {result.meta.nodeEnv} · Checked {new Date(result.meta.checkedAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </div>
  );
}