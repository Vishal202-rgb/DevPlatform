import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { fetchHealthCheck } from '../services/systemService';
import { useToast } from '../hooks/useToast';

// Status badge and accent configurations (Linear / Vercel dark theme palette)
const STATUS_CONFIG = {
  ok: {
    label: 'Passed',
    badgeText: 'Operational',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/20',
    badgeColor: 'text-emerald-400',
    dotBg: 'bg-emerald-400',
    glowColor: 'rgba(52, 211, 153, 0.25)',
    cardBorder: 'border-graphite-700/60 hover:border-graphite-600',
    rowBg: 'bg-graphite-900/40 hover:bg-graphite-850/60',
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  warning: {
    label: 'Warning',
    badgeText: 'Attention',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    badgeColor: 'text-amber-400',
    dotBg: 'bg-amber-400',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    cardBorder: 'border-amber-500/30 hover:border-amber-500/50',
    rowBg: 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06]',
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  error: {
    label: 'Failed',
    badgeText: 'Critical',
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/30',
    badgeColor: 'text-rose-400',
    dotBg: 'bg-rose-400',
    glowColor: 'rgba(244, 63, 94, 0.25)',
    cardBorder: 'border-rose-500/30 hover:border-rose-500/50',
    rowBg: 'bg-rose-500/[0.04] hover:bg-rose-500/[0.07]',
    icon: (
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
};

// Logical grouping of checks into developer infrastructure domains
const CATEGORIES = {
  env: {
    id: 'env',
    name: 'Environment Variables',
    shortName: 'Environment',
    description: 'Core secrets, API tokens, and deployment endpoint configuration',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-1-1l-3 3m2 8l-6 6a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H7a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.17a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l6 6" />
        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
    ),
  },
  auth_network: {
    id: 'auth_network',
    name: 'Authentication & Networking',
    shortName: 'Auth & Network',
    description: 'OAuth callback endpoints, token secret entropy, and CORS host alignment',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  ai: {
    id: 'ai',
    name: 'AI Engine & Model Services',
    shortName: 'AI Services',
    description: 'Gemini model capability checks and fallback chain reliability',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  runtime: {
    id: 'runtime',
    name: 'Database & Runtime Infrastructure',
    shortName: 'Database & Runtime',
    description: 'MongoDB active connection state and hosting environment synchronization',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
};

function getCategoryForCheck(check) {
  const id = check.id || '';
  if (id.startsWith('env_')) return 'env';
  if (id.startsWith('jwt_') || id.startsWith('github_') || id.startsWith('client_url')) return 'auth_network';
  if (id.startsWith('gemini_')) return 'ai';
  if (id.startsWith('mongo_') || id.startsWith('node_env_')) return 'runtime';
  return 'env';
}

const OVERALL_STATUS_CONFIG = {
  ok: {
    state: 'Healthy',
    badge: 'All Systems Operational',
    title: 'Platform Infrastructure Healthy',
    description: 'All required environment variables, database connections, OAuth parameters, and AI model routes are fully operational.',
    pillBg: 'bg-emerald-500/10',
    pillBorder: 'border-emerald-500/20',
    pillText: 'text-emerald-400',
    dotBg: 'bg-emerald-400',
    pingColor: 'bg-emerald-400',
    cardBorder: 'border-emerald-500/20',
    glowGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  warning: {
    state: 'Warning',
    badge: 'Attention Recommended',
    title: 'Configuration Warnings Detected',
    description: 'Core infrastructure is active, but non-critical configuration mismatches or fallback model parameters require review.',
    pillBg: 'bg-amber-500/10',
    pillBorder: 'border-amber-500/30',
    pillText: 'text-amber-400',
    dotBg: 'bg-amber-400',
    pingColor: 'bg-amber-400',
    cardBorder: 'border-amber-500/30',
    glowGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  error: {
    state: 'Failed',
    badge: 'Action Required',
    title: 'Critical Configuration Issues Detected',
    description: 'One or more required environment variables, secrets, or service endpoints are misconfigured. Review failing checks below.',
    pillBg: 'bg-rose-500/10',
    pillBorder: 'border-rose-500/30',
    pillText: 'text-rose-400',
    dotBg: 'bg-rose-400',
    pingColor: 'bg-rose-400',
    cardBorder: 'border-rose-500/30',
    glowGradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
};

// Clean copy button for resolution commands and hints
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      title="Copy to clipboard"
      className="inline-flex items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-800/80 px-2 py-1 text-[11px] font-mono text-mist-300 transition-colors hover:border-graphite-600 hover:bg-graphite-700 hover:text-mist-100"
    >
      {copied ? (
        <>
          <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <svg className="h-3 w-3 text-mist-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          <span>Copy Fix</span>
        </>
      )}
    </button>
  );
}

// Individual diagnostic check item row
function DiagnosticRow({ check }) {
  const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.warning;
  const isOk = check.status === 'ok';

  return (
    <div
      className={`group relative flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between transition-all duration-150 ${cfg.rowBg}`}
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {/* Status Indicator Icon */}
        <div
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeColor} mt-0.5`}
        >
          {cfg.icon}
        </div>

        {/* Content body */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs sm:text-sm font-medium text-mist-100 group-hover:text-mist-50 transition-colors">
              {check.label}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider font-semibold ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeColor}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotBg}`} />
              {cfg.label}
            </span>
          </div>

          <p className="text-xs sm:text-[13px] text-mist-400 leading-relaxed break-words">
            {check.message}
          </p>

          {/* Resolution Guide Box */}
          {check.hint && (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-graphite-700/80 bg-graphite-950/90 p-3 shadow-inner">
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-graphite-800/80 mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400/90 font-mono">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  <span>Suggested Resolution</span>
                </div>
                <CopyButton text={check.hint} />
              </div>
              <p className="font-mono text-[11px] text-mist-300 leading-normal selection:bg-amber-400/30 selection:text-amber-200 break-all sm:break-normal">
                {check.hint}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Subtle right timestamp or status marker on desktop */}
      <div className="hidden sm:flex sm:shrink-0 sm:items-center">
        <span
          className={`text-[11px] font-mono font-medium ${
            isOk ? 'text-mist-500' : cfg.badgeColor
          }`}
        >
          {isOk ? 'Verified' : 'Action Needed'}
        </span>
      </div>
    </div>
  );
}

// Category section container
function CategoryGroup({ category, checks }) {
  const okCount = checks.filter((c) => c.status === 'ok').length;
  const warningCount = checks.filter((c) => c.status === 'warning').length;
  const errorCount = checks.filter((c) => c.status === 'error').length;

  const hasIssues = errorCount > 0 || warningCount > 0;
  const sectionBorder = errorCount > 0
    ? 'border-rose-500/25'
    : warningCount > 0
    ? 'border-amber-500/25'
    : 'border-graphite-700/70';

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-graphite-900/90 shadow-panel transition-all duration-200 ${sectionBorder}`}
    >
      {/* Category Header */}
      <div className="flex flex-col gap-2 border-b border-graphite-700/60 bg-graphite-850/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-graphite-700 bg-graphite-800/90 text-mist-300 shadow-sm">
            {category.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-mist-100">
                {category.name}
              </h3>
              <span className="rounded-md bg-graphite-800 px-1.5 py-0.5 text-[10px] font-mono text-mist-400">
                {checks.length}
              </span>
            </div>
            <p className="text-[11px] text-mist-400 line-clamp-1">
              {category.description}
            </p>
          </div>
        </div>

        {/* Breakdown badges */}
        <div className="flex items-center gap-2 self-start sm:self-center font-mono text-[11px]">
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
            </span>
          )}
          {okCount > 0 && !hasIssues && (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {okCount} / {checks.length} Passing
            </span>
          )}
        </div>
      </div>

      {/* Row list */}
      <div className="divide-y divide-graphite-800/80">
        {checks.map((c) => (
          <DiagnosticRow key={c.id} check={c} />
        ))}
      </div>
    </div>
  );
}

// Compact metric summary card
function MetricPill({ label, count, icon, colorClass, borderClass, bgClass, active, onClick, id }) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className={`group flex flex-1 items-center justify-between gap-3 rounded-xl border p-3 sm:p-4 text-left transition-all duration-150 ${
        active
          ? `${borderClass} ${bgClass} ring-1 ring-amber-400/40 shadow-glow-sm`
          : 'border-graphite-750 bg-graphite-900/70 hover:border-graphite-600 hover:bg-graphite-850/80'
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-mist-400 group-hover:text-mist-300 transition-colors">
            {label}
          </span>
        </div>
        <p className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${colorClass}`}>
          {count}
        </p>
      </div>

      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-transform duration-150 group-hover:scale-105 ${bgClass} ${borderClass} ${colorClass}`}
      >
        {icon}
      </div>
    </button>
  );
}

// Full page component
export default function SystemHealth() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'error' | 'warning' | 'ok'
  const searchInputId = useId();

  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const runChecks = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsScanning(true);
    }
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
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    runChecks(true);
  }, [runChecks]);

  // Derived check collections
  const allChecks = useMemo(() => result?.checks || [], [result]);
  const erroredChecks = useMemo(() => allChecks.filter((c) => c.status === 'error'), [allChecks]);
  const warningChecks = useMemo(() => allChecks.filter((c) => c.status === 'warning'), [allChecks]);
  const okChecks = useMemo(() => allChecks.filter((c) => c.status === 'ok'), [allChecks]);

  // Overall system banner config
  const overallConfig = result
    ? OVERALL_STATUS_CONFIG[result.overallStatus] || OVERALL_STATUS_CONFIG.warning
    : OVERALL_STATUS_CONFIG.ok;

  // Filtered checks based on status filter & search query
  const filteredChecks = useMemo(() => {
    return allChecks.filter((check) => {
      // Status filter
      if (statusFilter !== 'all' && check.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesLabel = check.label?.toLowerCase().includes(query);
        const matchesMessage = check.message?.toLowerCase().includes(query);
        const matchesHint = check.hint?.toLowerCase().includes(query);
        const matchesId = check.id?.toLowerCase().includes(query);
        if (!matchesLabel && !matchesMessage && !matchesHint && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [allChecks, statusFilter, searchQuery]);

  // Group filtered checks by category
  const groupedChecks = useMemo(() => {
    const groups = {
      env: [],
      auth_network: [],
      ai: [],
      runtime: [],
    };

    filteredChecks.forEach((check) => {
      const categoryKey = getCategoryForCheck(check);
      if (groups[categoryKey]) {
        groups[categoryKey].push(check);
      } else {
        groups.env.push(check);
      }
    });

    return groups;
  }, [filteredChecks]);

  const isBusy = isLoading || isScanning;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Platform</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Infrastructure Diagnostics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 flex items-center gap-2.5">
            Deployment Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-mist-400 max-w-2xl leading-relaxed">
            Live infrastructure diagnostics verifying MongoDB latency, GitHub OAuth credentials, Gemini API connectivity, and environment variables.
          </p>
        </div>

        {/* Action Button & Timestamp */}
        <div className="flex flex-wrap items-center gap-3">
          {result?.meta?.checkedAt && (
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-mono text-mist-400">
              <span className="h-1.5 w-1.5 rounded-full bg-mist-500" />
              Last scan:{' '}
              <span className="text-mist-200">
                {new Date(result.meta.checkedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </span>
          )}

          <button
            id="run-diagnostics-btn"
            onClick={() => runChecks(false)}
            disabled={isBusy}
            aria-label="Run deployment diagnostics"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-all duration-150 hover:bg-amber-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-glow-sm"
          >
            <svg
              className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isBusy ? 'Running Diagnostics…' : 'Run Diagnostics'}</span>
          </button>
        </div>
      </div>

      {/* Network / Execution Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 shadow-panel animate-fade-in">
          <div className="flex items-center gap-2.5">
            <svg className="h-4 w-4 text-rose-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-mono">{error}</span>
          </div>
          <button
            id="retry-diagnostics-btn"
            onClick={() => runChecks(false)}
            className="rounded-lg border border-rose-500/30 bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
          >
            Retry Check
          </button>
        </div>
      )}

      {/* Loading Skeleton state on first mount */}
      {isLoading && !result ? (
        <div className="space-y-6 animate-fade-in">
          <div className="h-32 rounded-xl skeleton-shimmer border border-graphite-800" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl skeleton-shimmer border border-graphite-800" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-48 rounded-xl skeleton-shimmer border border-graphite-800" />
            <div className="h-48 rounded-xl skeleton-shimmer border border-graphite-800" />
          </div>
        </div>
      ) : result ? (
        <div className="space-y-6 animate-fade-in">
          {/* Active Scanning Pulse Bar during re-runs */}
          {isScanning && (
            <div className="relative overflow-hidden rounded-lg bg-amber-400/10 border border-amber-400/20 px-4 py-2 flex items-center justify-between text-xs font-mono text-amber-300 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <span>Scanning active services and validating configuration parameters…</span>
              </div>
              <span className="text-[11px] text-amber-400/70">In progress</span>
            </div>
          )}

          {/* Overall Status Hero Card */}
          <div
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${overallConfig.glowGradient} bg-graphite-900/90 p-5 sm:p-6 shadow-panel ${overallConfig.cardBorder}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-wider ${overallConfig.pillBg} ${overallConfig.pillBorder} ${overallConfig.pillText}`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${overallConfig.pingColor}`}
                      />
                      <span
                        className={`relative inline-flex h-2 w-2 rounded-full ${overallConfig.dotBg}`}
                      />
                    </span>
                    {overallConfig.badge}
                  </span>

                  <span className="text-xs font-mono text-mist-400 hidden sm:inline">
                    Status: <strong className="text-mist-200">{overallConfig.state}</strong>
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-mist-100">
                  {overallConfig.title}
                </h2>

                <p className="text-xs sm:text-sm text-mist-300 leading-relaxed">
                  {overallConfig.description}
                </p>
              </div>

              {/* Deployment Environment Badge */}
              <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t border-graphite-800/80 sm:border-t-0 font-mono text-xs text-mist-400">
                <div className="flex items-center gap-1.5 rounded-lg border border-graphite-750 bg-graphite-950/70 px-3 py-1.5">
                  <svg className="h-3.5 w-3.5 text-mist-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                  <span>
                    {result.meta?.vercelEnv
                      ? `Vercel · ${result.meta.vercelEnv}`
                      : `Node · ${result.meta?.nodeEnv || 'development'}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Summary Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricPill
              id="filter-all-btn"
              label="Total Checks"
              count={allChecks.length}
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              colorClass="text-mist-100"
              borderClass="border-graphite-700"
              bgClass="bg-graphite-800/50"
              icon={
                <svg className="h-4 w-4 text-mist-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              }
            />

            <MetricPill
              id="filter-passed-btn"
              label="Passed"
              count={okChecks.length}
              active={statusFilter === 'ok'}
              onClick={() => setStatusFilter('ok')}
              colorClass="text-emerald-400"
              borderClass="border-emerald-500/30"
              bgClass="bg-emerald-500/10"
              icon={
                <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />

            <MetricPill
              id="filter-warnings-btn"
              label="Warnings"
              count={warningChecks.length}
              active={statusFilter === 'warning'}
              onClick={() => setStatusFilter('warning')}
              colorClass="text-amber-400"
              borderClass="border-amber-500/30"
              bgClass="bg-amber-500/10"
              icon={
                <svg className="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />

            <MetricPill
              id="filter-failed-btn"
              label="Failures"
              count={erroredChecks.length}
              active={statusFilter === 'error'}
              onClick={() => setStatusFilter('error')}
              colorClass="text-rose-400"
              borderClass="border-rose-500/30"
              bgClass="bg-rose-500/10"
              icon={
                <svg className="h-4 w-4 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-graphite-750 bg-graphite-900/60 p-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mist-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <input
                id={searchInputId}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter checks by name, variable, or message..."
                className="w-full rounded-lg border border-graphite-750 bg-graphite-950/80 pl-9 pr-8 py-1.5 text-xs text-mist-200 placeholder:text-mist-500 focus:border-amber-400 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-500 hover:text-mist-300"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Quick Status Segmented Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-graphite-750 bg-graphite-950/60 p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  statusFilter === 'all'
                    ? 'bg-graphite-800 text-mist-100 font-semibold shadow-sm'
                    : 'text-mist-400 hover:text-mist-200'
                }`}
              >
                All ({allChecks.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('error')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  statusFilter === 'error'
                    ? 'bg-rose-500/20 text-rose-300 font-semibold shadow-sm border border-rose-500/30'
                    : 'text-mist-400 hover:text-rose-300'
                }`}
              >
                Failed ({erroredChecks.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('warning')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  statusFilter === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold shadow-sm border border-amber-500/30'
                    : 'text-mist-400 hover:text-amber-300'
                }`}
              >
                Warnings ({warningChecks.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ok')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  statusFilter === 'ok'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm border border-emerald-500/30'
                    : 'text-mist-400 hover:text-emerald-300'
                }`}
              >
                Passed ({okChecks.length})
              </button>
            </div>
          </div>

          {/* Grouped Categorized Checks */}
          <div className="space-y-5">
            {Object.keys(CATEGORIES).map((catKey) => {
              const category = CATEGORIES[catKey];
              const checks = groupedChecks[catKey] || [];
              if (checks.length === 0) return null;

              return (
                <CategoryGroup
                  key={category.id}
                  category={category}
                  checks={checks}
                  isScanning={isScanning}
                />
              );
            })}

            {/* Empty search filter state */}
            {filteredChecks.length === 0 && (
              <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/40 p-12 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-graphite-800 text-mist-400 mb-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" x2="16.65" y1="21" y2="16.65" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-mist-200">No diagnostic checks found</h4>
                <p className="mt-1 text-xs text-mist-400 max-w-sm mx-auto">
                  No checks match your current filter query &quot;{searchQuery || statusFilter}&quot;. Try resetting your filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-mist-200 hover:bg-graphite-700 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>

          {/* Infrastructure & Telemetry Metadata Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-graphite-750 bg-graphite-900/70 p-4 text-xs font-mono text-mist-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-mist-500">Host Runtime:</span>
              <span className="font-semibold text-mist-200">
                {result.meta?.isVercel ? 'Vercel Serverless' : 'Node.js Runtime'}
              </span>
              <span className="text-mist-600">·</span>
              <span className="text-mist-500">NODE_ENV:</span>
              <span className="font-semibold text-mist-200">
                {result.meta?.nodeEnv || 'development'}
              </span>
              {result.meta?.vercelEnv && (
                <>
                  <span className="text-mist-600">·</span>
                  <span className="text-mist-500">Target:</span>
                  <span className="font-semibold text-mist-200">
                    {result.meta.vercelEnv}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span>
                Verified:{' '}
                <span className="text-mist-200">
                  {new Date(result.meta?.checkedAt || Date.now()).toLocaleTimeString()}
                </span>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}