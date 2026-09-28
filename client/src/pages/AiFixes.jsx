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
  remediateIssue,
} from '../services/engineeringService';
import { calculateImpact } from '../services/impactService';

export default function AiFixes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(() => searchParams.get('repositoryId') || '');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [impactContext, setImpactContext] = useState(null);
  const [fixProposal, setFixProposal] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRemediating, setIsRemediating] = useState(false);
  const [remediationStep, setRemediationStep] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Helper to find repo by ID, _id, fullName, name, or githubId
  const findRepo = useCallback((repoIdentifier, repoList = repos) => {
    if (!repoIdentifier) return null;
    const idStr = String(repoIdentifier).trim().toLowerCase();
    return (
      (repoList || []).find((r) => {
        if (!r) return false;
        const rRepoId = r.repositoryId ? String(r.repositoryId).toLowerCase() : null;
        const rMongoId = r._id ? String(r._id).toLowerCase() : null;
        const rId = r.id ? String(r.id).toLowerCase() : null;
        const rGithubId = r.githubId ? String(r.githubId).toLowerCase() : null;
        const rFullName = r.fullName ? String(r.fullName).toLowerCase() : null;
        const rName = r.name ? String(r.name).toLowerCase() : null;

        if (rRepoId && rRepoId === idStr) return true;
        if (rMongoId && rMongoId === idStr) return true;
        if (rId && rId === idStr) return true;
        if (rGithubId && rGithubId === idStr) return true;
        if (rFullName && rFullName === idStr) return true;
        if (rName && rName === idStr) return true;

        if (rFullName && (rFullName.endsWith('/' + idStr) || idStr.endsWith('/' + (rName || '')))) {
          return true;
        }

        return false;
      }) || null
    );
  }, [repos]);

  const selectedRepo = useMemo(() => {
    return findRepo(selectedRepoId);
  }, [findRepo, selectedRepoId]);

  // Robustly filter issues for the currently selected repository
  const repoIssues = useMemo(() => {
    if (!selectedRepoId) return [];

    const currentRepo = findRepo(selectedRepoId);
    const currentMongoId = currentRepo?.repositoryId || currentRepo?._id || currentRepo?.id;
    const currentIdStr = currentMongoId ? String(currentMongoId).toLowerCase() : String(selectedRepoId).toLowerCase();
    const currentFullName = currentRepo?.fullName?.toLowerCase();
    const currentName = currentRepo?.name?.toLowerCase();
    const currentGithubId = currentRepo?.githubId ? String(currentRepo.githubId).toLowerCase() : null;

    return issues.filter((i) => {
      if (!i) return false;
      const iRepo = i.repository;
      if (!iRepo) return false;

      // If repository on issue is a string or ID
      if (typeof iRepo === 'string') {
        const iStr = iRepo.toLowerCase();
        if (iStr === currentIdStr) return true;
        if (currentFullName && iStr === currentFullName) return true;
        if (currentName && (iStr === currentName || iStr.endsWith('/' + currentName))) return true;
        return false;
      }

      // If repository on issue is an object { id, fullName, ... } or { _id, name, ... }
      const iRepoId = iRepo._id || iRepo.id || iRepo.repositoryId;
      if (iRepoId) {
        const iRepoIdStr = String(iRepoId).toLowerCase();
        if (iRepoIdStr === currentIdStr) return true;
        if (currentGithubId && iRepoIdStr === currentGithubId) return true;
      }

      const iFullName = (iRepo.fullName || iRepo.name || '')?.toLowerCase();
      if (currentFullName && iFullName && iFullName === currentFullName) {
        return true;
      }

      if (currentName && iFullName && (iFullName === currentName || iFullName.endsWith('/' + currentName))) {
        return true;
      }

      return false;
    });
  }, [issues, selectedRepoId, findRepo]);

  const handleSelectIssue = useCallback(async (issue, repoId) => {
    const activeRepo = findRepo(repoId || selectedRepoId);
    const activeRepoId = activeRepo?.repositoryId || activeRepo?._id || repoId || selectedRepoId;
    setSelectedIssue(issue);
    setFixProposal(null);
    setApplyResult(null);
    setTestResults(null);
    setVerificationResult(null);
    setRemediationStep('');
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
  }, [selectedRepoId, findRepo, setSearchParams]);

  const handleRepoChange = useCallback((newRepoId) => {
    setSelectedRepoId(newRepoId);
    setSelectedIssue(null);
    setImpactContext(null);
    setFixProposal(null);
    setApplyResult(null);
    setError('');
    setSuccessMsg('');

    // Synchronize URL query params immediately
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newRepoId) {
        next.set('repositoryId', newRepoId);
      } else {
        next.delete('repositoryId');
      }
      next.delete('issueId');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

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
      const allRepos = reposRes || [];
      const connected = allRepos.filter((r) => r.connected);
      const repoList = connected.length > 0 ? connected : allRepos;
      setRepos(repoList);

      const urlRepo = searchParams.get('repositoryId');
      let targetRepo = null;
      if (urlRepo) {
        targetRepo = (repoList || []).find((r) => {
          const rRepoId = r.repositoryId ? String(r.repositoryId).toLowerCase() : null;
          const rMongoId = r._id ? String(r._id).toLowerCase() : null;
          const rFullName = r.fullName ? String(r.fullName).toLowerCase() : null;
          const rName = r.name ? String(r.name).toLowerCase() : null;
          const uStr = urlRepo.toLowerCase();
          return rRepoId === uStr || rMongoId === uStr || rFullName === uStr || rName === uStr;
        });
      }
      if (!targetRepo && repoList.length > 0) {
        targetRepo = repoList[0];
      }

      if (targetRepo) {
        const resolvedId = targetRepo.repositoryId || targetRepo._id || targetRepo.fullName || targetRepo.name;
        setSelectedRepoId(resolvedId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load issues.');
    } finally {
      setIsLoading(false);
    }
  }, []); // Run on initial mount

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-restore issue from URL parameter when repoIssues change
  useEffect(() => {
    const paramIssueId = searchParams.get('issueId');
    if (paramIssueId && repoIssues.length > 0) {
      const matched = repoIssues.find(
        (i) => i._id === paramIssueId || i.id === paramIssueId || i.file === paramIssueId
      );
      if (matched && (!selectedIssue || (selectedIssue._id !== matched._id && selectedIssue.id !== matched.id))) {
        handleSelectIssue(matched, selectedRepoId);
      }
    }
  }, [searchParams, repoIssues, selectedIssue, handleSelectIssue, selectedRepoId]);

  // Refresh audit logs when selected repository changes
  useEffect(() => {
    const activeRepo = findRepo(selectedRepoId);
    const targetRepoId = activeRepo?.repositoryId || activeRepo?._id || selectedRepoId;
    if (targetRepoId) {
      fetchAuditTrail(targetRepoId, 10)
        .then((l) => setAuditLogs(l || []))
        .catch(() => setAuditLogs([]));
    } else {
      setAuditLogs([]);
    }
  }, [selectedRepoId, findRepo]);

  const handleGenerateFix = async () => {
    const activeRepo = findRepo(selectedRepoId);
    const targetRepoId = activeRepo?.repositoryId || activeRepo?._id || selectedRepoId;

    if (!targetRepoId || !selectedIssue) {
      setError('Please select a repository and an issue.');
      return;
    }

    // Defensive check: Ensure selected issue belongs to currently selected repository
    const issueRepo = selectedIssue.repository;
    const issueRepoId = issueRepo?._id || issueRepo?.id || issueRepo?.repositoryId || (typeof issueRepo === 'string' ? issueRepo : null);
    const issueRepoFullName = (issueRepo?.fullName || issueRepo?.name || (typeof issueRepo === 'string' ? issueRepo : ''))?.toLowerCase();
    const currentRepoFullName = (activeRepo?.fullName || activeRepo?.name || '')?.toLowerCase();
    const currentRepoIdStr = String(targetRepoId).toLowerCase();

    const matchesById = issueRepoId && String(issueRepoId).toLowerCase() === currentRepoIdStr;
    const matchesByName = issueRepoFullName && currentRepoFullName && (issueRepoFullName === currentRepoFullName || issueRepoFullName.endsWith('/' + currentRepoFullName) || currentRepoFullName.endsWith('/' + issueRepoFullName));

    if (!matchesById && !matchesByName) {
      setError('Selected issue belongs to a different repository. Please select an issue from the active repository.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMsg('');
    try {
      const proposal = await generateFixProposal(targetRepoId, {
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
      const rawMsg = err.response?.data?.message || err.message || 'Failed to generate AI fix proposal.';
      const cleanMsg = typeof rawMsg === 'string'
        ? rawMsg
            .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
            .replace(/AIza[a-zA-Z0-9_\-]{35}/g, '[REDACTED_API_KEY]')
            .replace(/models\/[a-zA-Z0-9_\-\.]+/gi, 'configured Gemini model')
        : 'Failed to generate AI fix proposal.';

      const code =
        err.code ||
        err.response?.data?.code ||
        (err.statusCode === 503 ||
        cleanMsg.toLowerCase().includes('temporarily busy') ||
        cleanMsg.toLowerCase().includes('temporarily unavailable') ||
        cleanMsg.toLowerCase().includes('high demand')
          ? 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE'
          : err.statusCode === 429 || cleanMsg.toLowerCase().includes('quota')
          ? 'AI_QUOTA_EXCEEDED'
          : err.statusCode === 404 || cleanMsg.toLowerCase().includes('unavailable') || cleanMsg.toLowerCase().includes('deprecated')
          ? 'AI_MODEL_UNAVAILABLE'
          : err.statusCode === 401 || err.statusCode === 403 || cleanMsg.toLowerCase().includes('authentication')
          ? 'AI_AUTH_ERROR'
          : 'AI_PROVIDER_ERROR');

      const finalMessage =
        code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE'
          ? 'AI service is temporarily busy. Please try again in a few moments.'
          : cleanMsg;

      setError({
        code,
        message: finalMessage,
        model: err.model || err.response?.data?.model,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyFix = async () => {
    const activeRepo = findRepo(selectedRepoId);
    const targetRepoId = activeRepo?.repositoryId || activeRepo?._id || selectedRepoId;

    if (!targetRepoId || !fixProposal) return;
    setIsApplying(true);
    setError(null);
    setSuccessMsg('');
    try {
      const result = await applyApprovedFix(targetRepoId, {
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
      fetchAuditTrail(targetRepoId, 10).then((l) => setAuditLogs(l || [])).catch(() => {});
    } catch (err) {
      const rawMsg = err.response?.data?.message || err.message || 'Failed to apply fix.';
      const cleanMsg = typeof rawMsg === 'string'
        ? rawMsg
            .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
            .replace(/AIza[a-zA-Z0-9_\-]{35}/g, '[REDACTED_API_KEY]')
            .replace(/models\/[a-zA-Z0-9_\-\.]+/gi, 'configured Gemini model')
        : 'Failed to apply fix.';

      const code =
        err.code ||
        err.response?.data?.code ||
        (err.statusCode === 503 ||
        cleanMsg.toLowerCase().includes('temporarily busy') ||
        cleanMsg.toLowerCase().includes('temporarily unavailable') ||
        cleanMsg.toLowerCase().includes('high demand')
          ? 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE'
          : err.statusCode === 429 || cleanMsg.toLowerCase().includes('quota')
          ? 'AI_QUOTA_EXCEEDED'
          : 'AI_PROVIDER_ERROR');

      const finalMessage =
        code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE'
          ? 'AI service is temporarily busy. Please try again in a few moments.'
          : cleanMsg;

      setError({
        code,
        message: finalMessage,
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemediateIssue = async () => {
    const activeRepo = findRepo(selectedRepoId);
    const targetRepoId = activeRepo?.repositoryId || activeRepo?._id || selectedRepoId;

    if (!targetRepoId || !selectedIssue) {
      setError('Please select a repository and an issue.');
      return;
    }

    setIsRemediating(true);
    setError(null);
    setSuccessMsg('');
    setTestResults(null);
    setVerificationResult(null);
    setRemediationStep('1. Analyzing Issue & Root Cause Context...');

    try {
      setRemediationStep('2. Generating Fix & Executing Target Tests in Sandbox...');
      const result = await remediateIssue(targetRepoId, {
        issueData: {
          issueId: selectedIssue._id || selectedIssue.id,
          analysisId: selectedIssue.analysis || selectedIssue.analysisId,
          filePath: selectedIssue.file,
          line: selectedIssue.line,
          description: selectedIssue.description,
          severity: selectedIssue.severity,
          recommendation: selectedIssue.recommendation,
          category: selectedIssue.category,
        },
        maxRetries: 3,
      });

      if (result.fixProposal) {
        setFixProposal(result.fixProposal);
      }
      if (result.testResults) {
        setTestResults(result.testResults);
      }
      if (result.verificationResult) {
        setVerificationResult(result.verificationResult);
      }
      if (result.appliedResult) {
        setApplyResult(result.appliedResult);
      }

      if (result.resolved === 'RESOLVED') {
        const passedCount = result.testResults?.passed || 0;
        const totalCount = result.testResults?.total || result.testResults?.passed || 1;
        setSuccessMsg(`✓ Remediation Verified: Fix resolved all target tests (${passedCount}/${totalCount} passed) in ${result.attempts} attempt(s).`);
      } else {
        setError({
          code: 'REMEDIATION_INCOMPLETE',
          message: result.error || 'Fix did not pass all target tests. Fix was NOT marked resolved.',
        });
      }

      // Refresh audit logs
      fetchAuditTrail(targetRepoId, 10).then((l) => setAuditLogs(l || [])).catch(() => {});
    } catch (err) {
      const rawMsg = err.response?.data?.message || err.message || 'Remediation failed.';
      const cleanMsg = typeof rawMsg === 'string'
        ? rawMsg
            .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
            .replace(/AIza[a-zA-Z0-9_\-]{35}/g, '[REDACTED_API_KEY]')
            .replace(/models\/[a-zA-Z0-9_\-\.]+/gi, 'configured Gemini model')
        : 'Remediation failed.';

      setError({
        code: 'REMEDIATION_ERROR',
        message: cleanMsg,
      });
    } finally {
      setIsRemediating(false);
      setRemediationStep('');
    }
  };

  const handleDiscardProposal = async () => {
    const activeRepo = findRepo(selectedRepoId);
    const targetRepoId = activeRepo?.repositoryId || activeRepo?._id || selectedRepoId;

    if (targetRepoId && fixProposal) {
      await revertSessionChanges(targetRepoId, {
        targetFile: fixProposal.filePath,
      }).catch(() => {});
      fetchAuditTrail(targetRepoId, 10).then((l) => setAuditLogs(l || [])).catch(() => {});
    }
    setFixProposal(null);
    setApplyResult(null);
    setTestResults(null);
    setVerificationResult(null);
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
              value={selectedRepo ? (selectedRepo.repositoryId || selectedRepo._id || selectedRepo.fullName || selectedRepo.name) : selectedRepoId}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="rounded-lg border border-graphite-750 bg-graphite-900 px-3 py-1.5 font-mono text-xs text-mist-100 outline-none focus:border-amber-400 cursor-pointer"
            >
              {repos.map((r) => {
                const optVal = r.repositoryId || r._id || r.fullName || r.name;
                return (
                  <option key={r.repositoryId || r._id || r.githubId || r.fullName || optVal} value={optVal}>
                    {r.fullName || r.name}
                  </option>
                );
              })}
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
        <div
          className={`rounded-xl border p-4 text-xs sm:text-sm font-mono animate-fade-in ${
            (typeof error === 'object' && error?.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('busy'))
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : (typeof error === 'object' && error?.code === 'AI_QUOTA_EXCEEDED') || (typeof error === 'string' && error.toLowerCase().includes('quota'))
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : (typeof error === 'object' && error?.code === 'AI_MODEL_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('unavailable'))
              ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
              : (typeof error === 'object' && error?.code === 'AI_AUTH_ERROR') || (typeof error === 'string' && error.toLowerCase().includes('auth'))
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">
              {(typeof error === 'object' && (error?.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE' || error?.code === 'AI_QUOTA_EXCEEDED')) || (typeof error === 'string' && (error.toLowerCase().includes('busy') || error.toLowerCase().includes('quota')))
                ? '⏳'
                : (typeof error === 'object' && error?.code === 'AI_MODEL_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('unavailable'))
                ? '⚠️'
                : '❌'}
            </span>
            <div className="space-y-1 flex-1">
              <div className="font-semibold flex items-center justify-between">
                <span>
                  {(typeof error === 'object' && error?.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('busy'))
                    ? 'AI Service Temporarily Busy'
                    : (typeof error === 'object' && error?.code === 'AI_QUOTA_EXCEEDED') || (typeof error === 'string' && error.toLowerCase().includes('quota'))
                    ? 'AI Quota Limit Exceeded'
                    : (typeof error === 'object' && error?.code === 'AI_MODEL_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('unavailable'))
                    ? 'AI Model Unavailable'
                    : (typeof error === 'object' && error?.code === 'AI_AUTH_ERROR') || (typeof error === 'string' && error.toLowerCase().includes('auth'))
                    ? 'Gemini Authentication Error'
                    : 'AI Fix Request Failed'}
                </span>
                {typeof error === 'object' && error?.model && (
                  <span className="text-[10px] rounded bg-graphite-800 px-2 py-0.5 text-mist-400 border border-graphite-700 font-mono">
                    Model: {error.model}
                  </span>
                )}
              </div>
              <p className="text-xs text-mist-300 font-sans leading-relaxed">
                {typeof error === 'string' ? error : error.message}
              </p>
              {((typeof error === 'object' && error?.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('busy'))) && (
                <p className="text-[11px] text-amber-400/90 font-sans pt-1">
                  💡 AI service is temporarily experiencing high demand. Please try again in a few moments.
                </p>
              )}
              {((typeof error === 'object' && error?.code === 'AI_QUOTA_EXCEEDED') || (typeof error === 'string' && error.toLowerCase().includes('quota'))) && (
                <p className="text-[11px] text-amber-400/90 font-sans pt-1">
                  💡 Tip: Free-tier rate limit or quota was reached. Please retry in a few moments, or configure a higher-capacity Gemini model in server configuration.
                </p>
              )}
              {((typeof error === 'object' && error?.code === 'AI_MODEL_UNAVAILABLE') || (typeof error === 'string' && error.toLowerCase().includes('unavailable'))) && (
                <p className="text-[11px] text-orange-400/90 font-sans pt-1">
                  💡 Tip: The configured AI model is no longer active. Check <code className="text-mist-100 font-mono">GEMINI_PRIMARY_MODEL</code> and <code className="text-mist-100 font-mono">GEMINI_FALLBACK_MODEL</code> in server settings.
                </p>
              )}
            </div>
          </div>
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
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-amber-400 font-semibold uppercase">
                        Target: {selectedIssue.file} {selectedIssue.line ? `(line ${selectedIssue.line})` : ''}
                      </span>
                      <span className="text-[10px] font-mono rounded bg-graphite-800 border border-graphite-700 px-2 py-0.5 text-mist-300">
                        {selectedIssue.category || 'logic'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-mist-100 mt-0.5 leading-snug">
                      {selectedIssue.description}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleRemediateIssue}
                      disabled={isRemediating || isGenerating}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-graphite-950 hover:bg-amber-300 disabled:opacity-50 transition-all font-mono shadow-sm"
                    >
                      <span>{isRemediating ? '⏳ Remediating & Verifying…' : '⚡ Autonomous Remediate & Verify'}</span>
                    </button>
                    {!fixProposal && (
                      <button
                        onClick={handleGenerateFix}
                        disabled={isGenerating || isRemediating}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-graphite-700 bg-graphite-800 px-3.5 py-2 text-xs font-semibold text-mist-300 hover:bg-graphite-750 disabled:opacity-50 transition-all font-mono"
                      >
                        <span>{isGenerating ? '⏳ Generating…' : 'Generate Diff Only'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {selectedIssue.recommendation && (
                  <p className="text-xs text-mist-300 leading-relaxed font-sans">
                    <strong className="text-mist-400 font-mono">Suggested Approach:</strong> {selectedIssue.recommendation}
                  </p>
                )}
              </div>

              {/* Remediation Active Progress Banner */}
              {isRemediating && (
                <div className="rounded-xl border border-amber-400/40 bg-graphite-950 p-4 font-mono text-xs text-amber-300 flex items-center gap-3 animate-pulse shadow-panel">
                  <span className="text-lg">⚙️</span>
                  <div className="space-y-0.5 flex-1">
                    <span className="font-bold block">Autonomous Remediation Workflow Running</span>
                    <p className="text-mist-300 text-[11px]">{remediationStep || 'Analyzing issue, creating minimal patch, and validating against target test suite...'}</p>
                  </div>
                </div>
              )}

              {/* Verification Agent Assessment Badge */}
              {verificationResult && (
                <div className="rounded-2xl border border-purple-500/40 bg-graphite-900/95 p-4 shadow-panel space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-graphite-800 pb-2">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-lg">🛡️</span>
                      <span className="text-xs font-bold text-mist-100 uppercase tracking-wider">
                        Verification Agent Status:
                      </span>
                      <span
                        className={`rounded px-2.5 py-0.5 text-xs font-bold uppercase ${
                          verificationResult.resolved === 'RESOLVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {verificationResult.resolved}
                      </span>
                      {verificationResult.confidence && (
                        <span className="text-[11px] text-mist-400">
                          (Confidence: {Math.round(verificationResult.confidence * 100)}%)
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/dashboard/pull-requests?repositoryId=${selectedRepo?.repositoryId || selectedRepo?._id || selectedRepoId}&issueId=${selectedIssue?._id || selectedIssue?.id || ''}&branch=${encodeURIComponent(applyResult?.branch || selectedIssue?.fixBranch || '')}`}
                      className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-graphite-950 hover:bg-amber-300 font-mono"
                    >
                      PR Readiness →
                    </Link>
                  </div>

                  <p className="text-xs sm:text-sm text-mist-200 leading-relaxed font-sans">
                    {verificationResult.reasoning}
                  </p>

                  {verificationResult.remainingRisks && (
                    <div className="text-xs font-mono text-mist-400 pt-0.5">
                      <strong className="text-amber-400">Remaining Risks:</strong> {verificationResult.remainingRisks}
                    </div>
                  )}
                </div>
              )}

              {/* Target Test Execution Scorecard */}
              {testResults && (
                <div className="rounded-2xl border border-graphite-750 bg-graphite-900/95 p-4 shadow-panel space-y-3 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 pb-2.5">
                    <div className="flex items-center gap-2 font-mono">
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider border ${
                          testResults.status === 'PASS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {testResults.status === 'PASS' ? '✓ TARGET TEST SUITE PASSED' : '✕ TARGET TEST SUITE FAILED'}
                      </span>
                      <span className="rounded bg-graphite-800 border border-graphite-700 px-2 py-0.5 text-xs font-bold text-amber-300">
                        {testResults.passed || 0} / {testResults.total || ((testResults.passed || 0) + (testResults.failed || 0)) || 1} passed
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-purple-300 font-semibold">
                      Runner: {testResults.runner || 'Target Test Runner'}
                    </span>
                  </div>

                  {/* Individual Scenarios Grid */}
                  {Array.isArray(testResults.tests) && testResults.tests.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-mono uppercase font-bold text-mist-400 block">
                        Validated Scenarios ({testResults.tests.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {testResults.tests.map((t, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg p-2.5 border font-mono text-xs flex flex-col justify-between gap-1 ${
                              t.status === 'passed'
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/5 border-rose-500/20 text-rose-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold truncate text-[11px]">
                                {t.status === 'passed' ? '✓' : '✕'} {t.name}
                              </span>
                              {t.duration && <span className="text-[10px] opacity-70">{t.duration}</span>}
                            </div>
                            {t.error && (
                              <p className="text-[10px] text-rose-400 bg-graphite-950 p-1.5 rounded border border-rose-500/20 break-all">
                                {t.error}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Output Preview */}
                  {testResults.stdout && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase font-bold text-mist-500 block">
                        Runner Output:
                      </span>
                      <pre className="rounded-lg bg-graphite-950 p-2.5 border border-graphite-800 font-mono text-[11px] text-mist-300 max-h-28 overflow-y-auto whitespace-pre-wrap leading-tight">
                        {testResults.stdout}
                      </pre>
                    </div>
                  )}
                </div>
              )}

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
                        onClick={handleRemediateIssue}
                        disabled={isRemediating}
                        className="rounded-lg border border-graphite-700 bg-graphite-800 px-3.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-graphite-750 transition-colors font-mono"
                      >
                        Re-Remediate
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
                          to={`/dashboard/tests?repositoryId=${selectedRepo?.repositoryId || selectedRepo?._id || selectedRepoId}&issueId=${selectedIssue?._id || selectedIssue?.id || ''}&filePath=${encodeURIComponent(selectedIssue?.file || '')}&branch=${encodeURIComponent(applyResult?.branch || selectedIssue?.fixBranch || '')}&analysisId=${encodeURIComponent(selectedIssue?.analysis || selectedIssue?.analysisId || '')}`}
                          className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 font-mono"
                        >
                          View in Tests →
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
