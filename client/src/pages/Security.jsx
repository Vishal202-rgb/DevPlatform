import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { IssueRowSkeleton } from '../components/Skeleton';
import { fetchAllIssues, fetchAllAnalyses } from '../services/analysisService';
import { fetchGithubRepositories } from '../services/githubService';
import { runSecurityAudit } from '../services/agentService';

const severityBadge = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  info: 'bg-mist-500/10 text-mist-400 border-mist-500/20',
};

export default function Security() {
  const [issues, setIssues] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedAuditRepoId, setSelectedAuditRepoId] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadSecurityData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [issuesRes, analysesRes, reposRes] = await Promise.all([
        fetchAllIssues().catch(() => []),
        fetchAllAnalyses().catch(() => []),
        fetchGithubRepositories().catch(() => []),
      ]);
      setIssues(issuesRes || []);
      setAnalyses(analysesRes || []);
      const connected = (reposRes || []).filter((r) => r.connected);
      setRepos(connected);
      if (connected.length > 0 && !selectedAuditRepoId) {
        setSelectedAuditRepoId(connected[0].repositoryId || connected[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load security findings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const handleRunSecurityAudit = async () => {
    if (!selectedAuditRepoId || isAuditing) return;
    setIsAuditing(true);
    setError('');
    try {
      const result = await runSecurityAudit(selectedAuditRepoId);
      setAuditResult(result);
    } catch (err) {
      setError(err.message || 'Security agent audit failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const securityIssues = useMemo(() => {
    return issues.filter((i) => i.category === 'security' || i.severity === 'critical');
  }, [issues]);

  const criticalCount = useMemo(
    () => securityIssues.filter((i) => i.severity === 'critical').length,
    [securityIssues]
  );
  const highCount = useMemo(
    () => securityIssues.filter((i) => i.severity === 'high').length,
    [securityIssues]
  );
  const mediumCount = useMemo(
    () => securityIssues.filter((i) => i.severity === 'medium').length,
    [securityIssues]
  );

  const securityScore = useMemo(() => {
    if (auditResult && typeof auditResult.securityScore === 'number') {
      return auditResult.securityScore;
    }
    if (!analyses.length) return null;
    const completed = analyses.filter((a) => a.overallScore !== null && a.overallScore !== undefined);
    if (!completed.length) return null;
    const penalty = criticalCount * 20 + highCount * 8 + mediumCount * 2;
    return Math.max(15, Math.min(100, 100 - penalty));
  }, [analyses, criticalCount, highCount, mediumCount, auditResult]);

  const filteredIssues = useMemo(() => {
    return securityIssues.filter((item) => {
      const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.file?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.recommendation?.toLowerCase().includes(q) ||
        item.repository?.fullName?.toLowerCase().includes(q);
      return matchesSeverity && matchesSearch;
    });
  }, [securityIssues, severityFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Engineering</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Security Intelligence &amp; Multi-Agent Audit</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Security Intelligence
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Automated detection of injection vectors, credential leaks, authentication flaws, and OWASP compliance with redacted secret masking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {repos.length > 0 && (
            <select
              value={selectedAuditRepoId}
              onChange={(e) => setSelectedAuditRepoId(e.target.value)}
              className="rounded-lg border border-graphite-750 bg-graphite-900 px-3 py-1.5 font-mono text-xs text-mist-100 outline-none focus:border-amber-400 transition-colors"
            >
              {repos.map((r) => (
                <option key={r.repositoryId || r.githubId} value={r.repositoryId || r._id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleRunSecurityAudit}
            disabled={isAuditing || !selectedAuditRepoId}
            className="btn-ai"
          >
            <span>{isAuditing ? '🛡️ Running Security Agent…' : '🛡️ Run Security Agent Audit'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 font-mono animate-fade-in">
          <span>{error}</span>
          <button
            onClick={loadSecurityData}
            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dm-card dm-card-hover p-5">
          <span className="text-xs font-mono text-mist-400 block font-medium">
            Security Health Score
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono tracking-tight tabular-nums ${
                securityScore === null
                  ? 'text-mist-500'
                  : securityScore >= 80
                  ? 'text-emerald-400'
                  : securityScore >= 50
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {securityScore !== null ? `${securityScore}/100` : 'Not analyzed'}
            </span>
          </div>
          <p className="mt-1 text-xs text-mist-500 font-mono">
            {securityScore !== null
              ? securityScore >= 80
                ? 'Strong security posture'
                : 'Remediation required'
              : 'Run scan to calculate'}
          </p>
        </div>

        <div className="dm-card dm-card-hover p-5">
          <span className="text-xs font-mono text-rose-400 block font-semibold">
            Critical Flaws
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-rose-400 tracking-tight tabular-nums">
              {auditResult ? (auditResult.summary?.critical || 0) : criticalCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-mist-500 font-mono">
            Requires immediate branch patch
          </p>
        </div>

        <div className="dm-card dm-card-hover p-5">
          <span className="text-xs font-mono text-orange-400 block font-semibold">
            High Severity
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-orange-400 tracking-tight tabular-nums">
              {auditResult ? (auditResult.summary?.high || 0) : highCount}
            </span>
          </div>
          <p className="mt-1 text-xs text-mist-500 font-mono">
            Elevated vulnerability risk
          </p>
        </div>

        <div className="dm-card dm-card-hover p-5">
          <span className="text-xs font-mono text-mist-400 block font-medium">
            Audited Repositories
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-mist-100 tracking-tight tabular-nums">
              {repos.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-mist-500 font-mono">
            Active codebases in workspace
          </p>
        </div>
      </div>

      {/* Security Agent Audit Results Live Panel */}
      {auditResult && (
        <div className="dm-card p-5 space-y-4 border-amber-400/30 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛡️</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-mono font-bold text-amber-400 uppercase tracking-wider">
                    Live Security Agent Findings ({auditResult.findings?.length || 0})
                  </h3>
                  <span className="rounded bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300">
                    Score: {auditResult.securityScore !== undefined ? auditResult.securityScore : (auditResult.summary?.securityScore ?? 100)}/100
                  </span>
                </div>
                <p className="text-[11px] text-mist-400 font-mono mt-0.5">
                  Execution completed in {(auditResult.durationMs / 1000).toFixed(2)}s • {auditResult.filesScanned || auditResult.summary?.filesScanned || 0} Files Scanned • {auditResult.rulesEvaluated || auditResult.summary?.rulesEvaluated || 0} Rules Evaluated • Credential Masking Active.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="rounded bg-rose-500/20 px-2 py-0.5 text-rose-300 font-bold">
                {auditResult.summary?.critical || 0} Critical
              </span>
              <span className="rounded bg-orange-500/20 px-2 py-0.5 text-orange-300 font-bold">
                {auditResult.summary?.high || 0} High
              </span>
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300 font-bold">
                {auditResult.summary?.medium || 0} Med
              </span>
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-sky-300 font-bold">
                {auditResult.summary?.low || 0} Low
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {auditResult.findings?.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1 font-mono">
                <p className="text-xs text-emerald-400 font-bold">
                  ✓ Clean Security Posture: No critical vulnerabilities or exposed credentials detected.
                </p>
                <p className="text-[11px] text-mist-400">
                  Evaluated {auditResult.rulesEvaluated || auditResult.summary?.rulesEvaluated || 0} security rules across {auditResult.filesScanned || auditResult.summary?.filesScanned || 0} repository source files with 0 policy violations. Health Score: 100/100.
                </p>
              </div>
            ) : (
              auditResult.findings?.map((f, i) => (
                <div key={i} className="rounded-xl border border-graphite-750 bg-graphite-850/90 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityBadge[f.severity] || severityBadge.medium}`}>
                        {f.severity}
                      </span>
                      {f.category && (
                        <span className="rounded bg-graphite-800 px-2 py-0.5 text-[10px] text-mist-300 border border-graphite-700">
                          {f.category}
                        </span>
                      )}
                      <span className="font-semibold text-mist-100">{f.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-mist-400 text-[11px]">
                      {f.confidence !== undefined && (
                        <span className="text-amber-400/80">
                          {Math.round(f.confidence * 100)}% conf
                        </span>
                      )}
                      <span>
                        {f.filePath}{f.startLine ? `:${f.startLine}${f.endLine && f.endLine !== f.startLine ? `-${f.endLine}` : ''}` : ''}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-mist-200 leading-relaxed">{f.description || f.explanation}</p>

                  {f.evidence && (
                    <div className="rounded bg-graphite-900 p-2 font-mono text-[11px] text-amber-300/90 border border-graphite-800 overflow-x-auto">
                      <span className="text-mist-500 block text-[10px] uppercase font-semibold">Evidence:</span>
                      <code>{f.evidence}</code>
                    </div>
                  )}

                  <div className="rounded bg-graphite-950 p-2 text-xs text-mist-300 border border-graphite-800">
                    <span className="text-emerald-400 font-semibold font-mono text-[10px] block uppercase">
                      Recommendation:
                    </span>
                    {f.recommendation}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search security findings, files, or rules…"
            className="w-full rounded-lg border border-graphite-750 bg-graphite-900 px-3 py-2 pl-9 text-xs sm:text-sm text-mist-100 placeholder:text-mist-500 focus:border-amber-400 outline-none"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-mist-500" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-graphite-750 bg-graphite-900 p-1 font-mono text-xs">
          {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`rounded-md px-3 py-1 text-xs capitalize transition-colors ${
                severityFilter === sev
                  ? 'bg-amber-400 text-graphite-950 font-bold shadow-sm'
                  : 'text-mist-400 hover:text-mist-100 hover:bg-graphite-800'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Security Findings List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <IssueRowSkeleton key={i} />
          ))}
        </div>
      ) : securityIssues.length === 0 && !auditResult ? (
        <EmptyState
          icon="🛡️"
          title="No security vulnerabilities detected"
          description="Your analyzed repositories have clean security postures with zero critical injection or authentication flaws."
          actionLabel="Run Security Agent"
          onAction={handleRunSecurityAudit}
        />
      ) : filteredIssues.length === 0 && !auditResult ? (
        <EmptyState
          icon="🔍"
          title="No findings match filter"
          description="Try selecting a different severity tab or clearing your search keywords."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearchQuery('');
            setSeverityFilter('all');
          }}
        />
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue, idx) => (
            <div
              key={issue._id || idx}
              className="dm-card p-4 hover:border-graphite-650 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        severityBadge[issue.severity] || severityBadge.medium
                      }`}
                    >
                      {issue.severity}
                    </span>

                    {issue.repository && (
                      <Link
                        to={`/dashboard/repositories/${issue.repository.id}/analysis`}
                        className="text-xs text-mist-300 hover:text-amber-400 transition-colors truncate"
                      >
                        {issue.repository.fullName}
                      </Link>
                    )}

                    <span className="text-mist-500 text-xs">/</span>
                    <span className="text-xs text-amber-400/90 truncate">
                      {issue.file} {issue.line ? `:${issue.line}` : ''}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-mist-100 font-medium leading-relaxed">
                    {issue.description}
                  </p>

                  <div className="mt-2 rounded-lg bg-graphite-950/70 p-2.5 border border-graphite-800 text-xs text-mist-300">
                    <span className="text-amber-400 font-semibold font-mono text-[11px] block mb-1">
                      Remediation Strategy:
                    </span>
                    <p className="leading-relaxed">{issue.recommendation}</p>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col items-end gap-2">
                  {issue.repository && (
                    <Link
                      to={`/dashboard/repositories/${issue.repository.id}/analysis`}
                      className="btn-secondary !text-xs !py-1.5 !px-3"
                    >
                      View in Report →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
