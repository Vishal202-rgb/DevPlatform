import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { TableRowSkeleton } from '../components/Skeleton';
import { fetchAllIssues } from '../services/analysisService';
import { fetchGithubRepositories } from '../services/githubService';
import {
  generateFixProposal,
  applyApprovedFix,
  revertSessionChanges,
  fetchAuditTrail,
} from '../services/engineeringService';
import { calculateImpact } from '../services/impactService';

export default function AiFixes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [impactContext, setImpactContext] = useState(null);
  const [fixProposal, setFixProposal] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const paramRepoId = searchParams.get('repositoryId');
  const paramIssueId = searchParams.get('issueId');

  const repoIssues = useMemo(() => {
    if (!selectedRepoId) return issues;
    return issues.filter((i) => {
      const rId = i.repository?._id || i.repository?.id || i.repository;
      return rId === selectedRepoId || String(rId) === String(selectedRepoId);
    });
  }, [issues, selectedRepoId]);

  const handleSelectIssue = useCallback(async (issue, repoId) => {
    const activeRepoId = repoId || selectedRepoId;
    setSelectedIssue(issue);
    setFixProposal(null);
    setApplyResult(null);
    setError('');
    setSuccessMsg('');

    if (activeRepoId && (issue?._id || issue?.id)) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('repositoryId', activeRepoId);
        next.set('issueId', issue._id || issue.id);
        return next;
      }, { replace: true });
    }

    // Pre-calculate impact analysis context for the file
    if (activeRepoId && issue?.file) {
      try {
        const impact = await calculateImpact(activeRepoId, issue.file);
        setImpactContext(impact);
      } catch {
        setImpactContext(null);
      }
    }
  }, [selectedRepoId, setSearchParams]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [issuesRes, reposRes] = await Promise.all([
        fetchAllIssues().catch(() => []),
        fetchGithubRepositories().catch(() => []),
      ]);
      const fetchedIssues = issuesRes || [];
      setIssues(fetchedIssues);
      const connected = (reposRes || []).filter((r) => r.connected);
      setRepos(connected);

      // Determine initial active repo
      let targetRepoId = paramRepoId;
      if (!targetRepoId && connected.length > 0) {
        targetRepoId = connected[0].repositoryId || connected[0]._id;
      }
      if (targetRepoId) {
        setSelectedRepoId(targetRepoId);
      }

      // Auto-restore issue if issueId or target is present in URL params
      if (paramIssueId && fetchedIssues.length > 0) {
        const matched = fetchedIssues.find(
          (i) =>
            i._id === paramIssueId ||
            i.id === paramIssueId ||
            i.file === paramIssueId
        );
        if (matched) {
          handleSelectIssue(matched, targetRepoId);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load issues.');
    } finally {
      setIsLoading(false);
    }
  }, [paramRepoId, paramIssueId, handleSelectIssue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateFix = async () => {
    if (!selectedRepoId || !selectedIssue) return;
    setIsGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const proposal = await generateFixProposal(selectedRepoId, {
        issueId: selectedIssue._id || selectedIssue.id,
        analysisId: selectedIssue.analysis || selectedIssue.analysisId,
        filePath: selectedIssue.file,
        line: selectedIssue.line,
        description: selectedIssue.description,
        severity: selectedIssue.severity,
        recommendation: selectedIssue.recommendation,
      });
      setFixProposal(proposal);
    } catch (err) {
      setError(err.message || 'Failed to generate AI fix proposal.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyFix = async () => {
    if (!selectedRepoId || !fixProposal) return;
    setIsApplying(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await applyApprovedFix(selectedRepoId, {
        issueId: fixProposal.issueId,
        analysisId: fixProposal.analysisId,
        filePath: fixProposal.filePath,
        proposedContent: fixProposal.fullProposedContent,
        originalFileSha: fixProposal.originalFileSha,
        originalContentHash: fixProposal.originalContentHash,
      });
      setApplyResult(result);
      setSuccessMsg(`Fix committed to isolated branch "${result.branch}".`);

      // Refresh audit logs
      fetchAuditTrail(selectedRepoId, 10).then((l) => setAuditLogs(l || []));
    } catch (err) {
      setError(err.message || 'Failed to apply fix.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscardProposal = async () => {
    if (selectedRepoId && fixProposal) {
      await revertSessionChanges(selectedRepoId, {
        targetFile: fixProposal.filePath,
      }).catch(() => {});
      fetchAuditTrail(selectedRepoId, 10).then((l) => setAuditLogs(l || []));
    }
    setFixProposal(null);
    setApplyResult(null);
    setSuccessMsg('Fix proposal discarded.');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Automation</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">AI Fix Agent &amp; Diff Preview</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            AI Fixes &amp; Code Remediation
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Targeted AI code modifications with Security Gate checks, unified diff inspection, and safe branch commit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {repos.length > 0 && (
            <select
              value={selectedRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setSelectedIssue(null);
                setFixProposal(null);
                setApplyResult(null);
              }}
              className="rounded-lg border border-graphite-750 bg-graphite-900 px-3 py-1.5 font-mono text-xs text-mist-100 outline-none focus:border-amber-400"
            >
              {repos.map((r) => (
                <option key={r.repositoryId || r.githubId} value={r.repositoryId || r._id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-750 bg-graphite-800 px-3.5 py-2 text-xs font-semibold text-mist-300 transition-colors hover:bg-graphite-750 hover:text-mist-100 disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 font-mono animate-fade-in">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-300 font-mono animate-fade-in">
          ✓ {successMsg}
        </div>
      )}

      {/* Main Grid: Left = Issue Picker / Impact; Right = Diff Preview & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Issues List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-mist-300">
                Issues for Remediation ({repoIssues.length})
              </h2>
              <span className="text-[10px] font-mono text-amber-400">Select to Fix</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-graphite-750 bg-graphite-850/60 p-3 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 w-16 bg-graphite-750 rounded" />
                      <div className="h-3 w-28 bg-graphite-750 rounded" />
                    </div>
                    <div className="h-3 w-4/5 bg-graphite-750 rounded mb-1" />
                    <div className="h-3 w-2/3 bg-graphite-750 rounded" />
                  </div>
                  <div className="rounded-xl border border-graphite-750 bg-graphite-850/60 p-3 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 w-16 bg-graphite-750 rounded" />
                      <div className="h-3 w-28 bg-graphite-750 rounded" />
                    </div>
                    <div className="h-3 w-4/5 bg-graphite-750 rounded mb-1" />
                    <div className="h-3 w-2/3 bg-graphite-750 rounded" />
                  </div>
                  <div className="rounded-xl border border-graphite-750 bg-graphite-850/60 p-3 animate-pulse">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-4 w-16 bg-graphite-750 rounded" />
                      <div className="h-3 w-28 bg-graphite-750 rounded" />
                    </div>
                    <div className="h-3 w-4/5 bg-graphite-750 rounded mb-1" />
                    <div className="h-3 w-2/3 bg-graphite-750 rounded" />
                  </div>
                </div>
              ) : repoIssues.length === 0 ? (
                <p className="text-xs text-mist-500 font-mono italic p-3 text-center">
                  No issues detected for this repository.
                </p>
              ) : (
                repoIssues.map((issue, idx) => {
                  const isSelected = selectedIssue?._id === issue._id || selectedIssue === issue;
                  return (
                    <button
                      key={issue._id || idx}
                      onClick={() => handleSelectIssue(issue)}
                      className={`w-full rounded-xl p-3 text-left transition-all border ${
                        isSelected
                          ? 'border-amber-400/60 bg-graphite-800 shadow-sm'
                          : 'border-graphite-800 bg-graphite-850/80 hover:bg-graphite-800 hover:border-graphite-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                        <span
                          className={`rounded px-1.5 py-0.2 font-bold uppercase ${
                            issue.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300'
                              : issue.severity === 'high'
                              ? 'bg-orange-500/20 text-orange-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <span className="text-mist-400 truncate max-w-[140px]">
                          {issue.file} {issue.line ? `:${issue.line}` : ''}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-mist-200 line-clamp-2 leading-relaxed">
                        {issue.description}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Impact Context Card for Selected Issue */}
          {impactContext && (
            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel space-y-2 animate-fade-in">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-mist-300 flex items-center justify-between">
                <span>⚡ Blast Radius Impact</span>
                <span className="text-[10px] text-amber-400 font-bold">{impactContext.riskLevel} Risk</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                <div className="rounded bg-graphite-850 p-2 text-mist-300">
                  <span className="text-mist-500 block text-[10px]">Direct Callers:</span>
                  <span className="text-amber-400 font-bold">{impactContext.directDependents?.length || 0}</span> files
                </div>
                <div className="rounded bg-graphite-850 p-2 text-mist-300">
                  <span className="text-mist-500 block text-[10px]">Downstream:</span>
                  <span className="text-purple-400 font-bold">{impactContext.indirectDependents?.length || 0}</span> files
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Fix & Unified Diff Preview */}
        <div className="lg:col-span-8 space-y-4">
          {!selectedIssue ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-750 bg-graphite-900/40 p-6 text-center">
              <span className="text-3xl">🛠️</span>
              <h3 className="mt-2 text-sm font-semibold text-mist-100">Select an issue to remediate</h3>
              <p className="mt-1 text-xs text-mist-400 max-w-sm">
                Choose any reported bug or vulnerability on the left to review its impact, inspect the AI diff, and commit the fix safely.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Target Header Card */}
              <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 pb-2.5">
                  <div>
                    <span className="text-[11px] font-mono text-amber-400 font-semibold uppercase">
                      Target File: {selectedIssue.file} {selectedIssue.line ? `(line ${selectedIssue.line})` : ''}
                    </span>
                    <h3 className="text-sm font-bold text-mist-100 mt-0.5 leading-snug">
                      {selectedIssue.description}
                    </h3>
                  </div>

                  {!fixProposal && (
                    <button
                      onClick={handleGenerateFix}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 hover:bg-amber-300 disabled:opacity-50 transition-all font-mono shadow-sm"
                    >
                      <span>{isGenerating ? '⏳ Generating Fix…' : '⚡ Generate AI Fix'}</span>
                    </button>
                  )}
                </div>

                {selectedIssue.recommendation && (
                  <p className="text-xs text-mist-300 leading-relaxed font-sans">
                    <strong className="text-mist-400 font-mono">Suggested Approach:</strong> {selectedIssue.recommendation}
                  </p>
                )}
              </div>

              {/* Fix Proposal & Diff Preview Canvas */}
              {fixProposal && (
                <div className="rounded-2xl border border-graphite-750 bg-graphite-900/95 shadow-panel overflow-hidden space-y-0 animate-fade-in">
                  {/* Diff Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 px-5 py-3.5 bg-graphite-850/90">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-mist-100">Unified Diff Preview</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300 font-semibold text-[11px]">
                        +{fixProposal.diff?.additions || 0}
                      </span>
                      <span className="rounded bg-rose-500/20 px-2 py-0.5 text-rose-300 font-semibold text-[11px]">
                        -{fixProposal.diff?.deletions || 0}
                      </span>
                    </div>

                    {/* Security Gate Badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          fixProposal.securityCheck?.safe
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                        }`}
                      >
                        {fixProposal.securityCheck?.safe ? '✓ Security Gate Cleared' : '⚠️ Security Review Required'}
                      </span>
                    </div>
                  </div>

                  {/* Security Warnings if Flagged */}
                  {fixProposal.securityCheck?.warnings?.length > 0 && (
                    <div className="border-b border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 font-mono space-y-1">
                      <span className="font-bold block uppercase">Security Gate Warnings:</span>
                      {fixProposal.securityCheck.warnings.map((w, idx) => (
                        <p key={idx}>• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Diff Viewer Lines */}
                  <div className="max-h-96 overflow-y-auto bg-graphite-950 p-4 font-mono text-xs leading-relaxed space-y-0.5">
                    {fixProposal.diff?.diffLines?.map((line, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start px-2 py-0.5 rounded ${
                          line.type === 'add'
                            ? 'bg-emerald-950/40 text-emerald-300'
                            : line.type === 'delete'
                            ? 'bg-rose-950/40 text-rose-300'
                            : 'text-mist-400'
                        }`}
                      >
                        <span className="w-8 select-none text-right text-mist-600 mr-3 text-[10px]">
                          {line.lineNum}
                        </span>
                        <pre className="font-mono whitespace-pre-wrap break-all flex-1">{line.content}</pre>
                      </div>
                    ))}
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite-800 p-4 bg-graphite-850/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDiscardProposal}
                        className="rounded-lg border border-graphite-700 bg-graphite-800 px-3.5 py-1.5 text-xs font-semibold text-mist-400 hover:text-mist-200 transition-colors font-mono"
                      >
                        Reject &amp; Discard
                      </button>
                      <button
                        onClick={handleGenerateFix}
                        disabled={isGenerating}
                        className="rounded-lg border border-graphite-700 bg-graphite-800 px-3.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-graphite-750 transition-colors font-mono"
                      >
                        Regenerate
                      </button>
                    </div>

                    {!applyResult ? (
                      <button
                        onClick={handleApplyFix}
                        disabled={isApplying}
                        className="rounded-xl bg-amber-400 px-5 py-2 text-xs font-semibold text-graphite-950 hover:bg-amber-300 disabled:opacity-50 transition-all shadow-sm font-mono active:scale-95"
                      >
                        {isApplying ? '⏳ Validating & Committing…' : '✓ Accept & Apply Fix'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-emerald-400 font-bold">✓ Committed on branch</span>
                        {applyResult.compareUrl && (
                          <a
                            href={applyResult.compareUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-graphite-950 hover:bg-emerald-300"
                          >
                            Compare on GitHub ↗
                          </a>
                        )}
                        <Link
                          to={`/dashboard/tests?repositoryId=${selectedRepoId}&issueId=${selectedIssue?._id || selectedIssue?.id || ''}&filePath=${encodeURIComponent(selectedIssue?.file || '')}&branch=${encodeURIComponent(applyResult?.branch || selectedIssue?.fixBranch || '')}&analysisId=${encodeURIComponent(selectedIssue?.analysis || selectedIssue?.analysisId || '')}`}
                          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 font-mono"
                        >
                          Generate Tests →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audit History Timeline */}
          {auditLogs.length > 0 && (
            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-mist-400">
                Engineering Action Trail
              </h3>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-center justify-between rounded-lg bg-graphite-850 px-3 py-2 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 text-mist-200">
                      <span className={`h-2 w-2 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span>{log.message}</span>
                    </div>
                    <span className="text-[10px] text-mist-500">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
