import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { fetchAllIssues } from '../services/analysisService';
import { fetchGithubRepositories } from '../services/githubService';
import {
  generateComprehensiveTests,
  applyApprovedTests,
  executeControlledTests,
  verifyFixResolution,
  diagnoseTestFailure,
  remediateIssue,
} from '../services/engineeringService';

export default function Tests() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeBranch, setActiveBranch] = useState('');
  const [generatedSuite, setGeneratedSuite] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingTests, setIsApplyingTests] = useState(false);
  const [applyTestResult, setApplyTestResult] = useState(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [isRemediating, setIsRemediating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const paramRepoId = searchParams.get('repositoryId');
  const paramIssueId = searchParams.get('issueId');
  const paramBranch = searchParams.get('branch');
  const paramFilePath = searchParams.get('filePath') || searchParams.get('targetFile');
  const paramAnalysisId = searchParams.get('analysisId');

  // Key for local session persistence to survive page refreshes
  const getPersistenceKey = useCallback((repoId, issueId) => {
    if (!repoId || !issueId) return null;
    return `devmind_test_session_${repoId}_${issueId}`;
  }, []);

  const restoreSessionState = useCallback((repoId, issueId) => {
    const key = getPersistenceKey(repoId, issueId);
    if (!key) return;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.generatedSuite) setGeneratedSuite(data.generatedSuite);
        if (data.applyTestResult) setApplyTestResult(data.applyTestResult);
        if (data.testResults) setTestResults(data.testResults);
        if (data.verificationResult) setVerificationResult(data.verificationResult);
        if (data.diagnosis) setDiagnosis(data.diagnosis);
        if (data.activeBranch) setActiveBranch(data.activeBranch);
      }
    } catch {
      // Ignore cache parse errors
    }
  }, [getPersistenceKey]);

  const saveSessionState = useCallback((updates) => {
    const issueKey = selectedIssue?._id || selectedIssue?.id || paramIssueId;
    const repoKey = selectedRepoId || paramRepoId;
    const key = getPersistenceKey(repoKey, issueKey);
    if (!key) return;
    try {
      const existing = JSON.parse(sessionStorage.getItem(key) || '{}');
      const combined = { ...existing, ...updates };
      sessionStorage.setItem(key, JSON.stringify(combined));
    } catch {
      // Ignore storage errors
    }
  }, [selectedIssue, paramIssueId, selectedRepoId, paramRepoId, getPersistenceKey]);

  const handleSelectIssue = useCallback((issue, repoId, branchFromUrl) => {
    const activeRepoId = repoId || selectedRepoId;
    setSelectedIssue(issue);
    setGeneratedSuite(null);
    setApplyTestResult(null);
    setTestResults(null);
    setVerificationResult(null);
    setDiagnosis(null);
    setError('');
    setSuccessMsg('');

    const targetBranch = branchFromUrl || paramBranch || issue.testBranch || issue.fixBranch || '';
    setActiveBranch(targetBranch);

    // Update URL query parameters so navigation & refreshes preserve the full context
    if (activeRepoId && issue?._id) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('repositoryId', activeRepoId);
        next.set('issueId', issue._id || issue.id);
        if (issue.file) next.set('filePath', issue.file);
        if (targetBranch) next.set('branch', targetBranch);
        if (issue.analysis || issue.analysisId) next.set('analysisId', issue.analysis || issue.analysisId);
        return next;
      }, { replace: true });
    }

    // Attempt restoring previously generated test state for this issue
    restoreSessionState(activeRepoId, issue._id || issue.id);
  }, [selectedRepoId, paramBranch, setSearchParams, restoreSessionState]);

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

      // 1. Determine active repository from URL or connected list
      let targetRepoId = paramRepoId;
      if (!targetRepoId && connected.length > 0) {
        targetRepoId = connected[0].repositoryId || connected[0]._id;
      }
      if (targetRepoId) {
        setSelectedRepoId(targetRepoId);
      }

      if (paramBranch) {
        setActiveBranch(paramBranch);
      }

      // 2. Auto-match selected issue if context is in URL
      if (fetchedIssues.length > 0 && (paramIssueId || paramFilePath)) {
        const matched = fetchedIssues.find(
          (i) =>
            (paramIssueId && (i._id === paramIssueId || i.id === paramIssueId)) ||
            (paramFilePath && i.file === paramFilePath && (!targetRepoId || i.repository?._id === targetRepoId || i.repository?.id === targetRepoId || i.repository === targetRepoId))
        );

        if (matched) {
          handleSelectIssue(matched, targetRepoId, paramBranch);
        } else if (paramIssueId) {
          setError('The original issue is no longer available in the repository analysis.');
        }
      } else if (paramRepoId && connected.length > 0 && !connected.some((r) => (r.repositoryId || r._id) === paramRepoId)) {
        setError('Repository context is unavailable or disconnected.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load test candidates.');
    } finally {
      setIsLoading(false);
    }
  }, [paramRepoId, paramIssueId, paramFilePath, paramBranch, handleSelectIssue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedRepo = useMemo(() => {
    return repos.find((r) => (r.repositoryId || r._id) === selectedRepoId);
  }, [repos, selectedRepoId]);

  const repoIssues = useMemo(() => {
    if (!selectedRepoId) return issues;
    return issues.filter(
      (i) =>
        i.repository?._id === selectedRepoId ||
        i.repository?.id === selectedRepoId ||
        i.repository === selectedRepoId
    );
  }, [issues, selectedRepoId]);

  const handleGenerateTests = async () => {
    if (!selectedRepoId || !selectedIssue) return;
    setIsGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const suite = await generateComprehensiveTests(selectedRepoId, {
        filePath: selectedIssue.file,
        issueDescription: selectedIssue.description,
        fixExplanation: selectedIssue.recommendation,
        branch: activeBranch || undefined,
      });
      setGeneratedSuite(suite);
      saveSessionState({ generatedSuite: suite });
      setSuccessMsg('4-Scenario test suite generated successfully.');
    } catch (err) {
      const msg = err.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE' || err.statusCode === 503
        ? 'AI service is temporarily busy. Please try again in a few moments.'
        : err.message || 'Failed to generate test suite.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyTests = async () => {
    if (!selectedRepoId || !generatedSuite) return;
    setIsApplyingTests(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await applyApprovedTests(selectedRepoId, {
        issueId: selectedIssue?._id || selectedIssue?.id || paramIssueId,
        analysisId: selectedIssue?.analysis || selectedIssue?.analysisId || paramAnalysisId,
        filePath: selectedIssue?.file || paramFilePath,
        testFilePath: generatedSuite.testFilePath,
        testCode: generatedSuite.testCode,
        branch: activeBranch || selectedIssue?.fixBranch || undefined,
      });
      setApplyTestResult(result);
      if (result.branch) {
        setActiveBranch(result.branch);
        saveSessionState({ applyTestResult: result, activeBranch: result.branch });
      }
      setSuccessMsg(`Test suite committed to branch "${result.branch}".`);
    } catch (err) {
      const msg = err.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE' || err.statusCode === 503
        ? 'AI service is temporarily busy. Please try again in a few moments.'
        : err.message || 'Failed to apply test suite to repository branch.';
      setError(msg);
    } finally {
      setIsApplyingTests(false);
    }
  };

  const handleRunTests = async () => {
    if (!selectedRepoId) return;
    setIsRunningTests(true);
    setError('');
    setSuccessMsg('');
    try {
      const payload = {
        repositoryId: selectedRepoId,
        owner: selectedRepo?.githubOwner || selectedRepo?.owner,
        repo: selectedRepo?.name,
        branch: activeBranch || selectedIssue?.testBranch || selectedIssue?.fixBranch || selectedRepo?.defaultBranch,
        analysisId: selectedIssue?.analysis || selectedIssue?.analysisId || paramAnalysisId,
        issueId: selectedIssue?._id || selectedIssue?.id || paramIssueId,
        targetFile: selectedIssue?.file || paramFilePath,
        filePath: selectedIssue?.file || paramFilePath,
        testFilePath: generatedSuite?.testFilePath,
        testCode: generatedSuite?.testCode,
        language: selectedRepo?.language || (selectedIssue?.file?.endsWith('.c') ? 'c' : undefined),
        framework: generatedSuite?.framework,
        suggestedCommand: generatedSuite?.suggestedCommand,
        command: generatedSuite?.suggestedCommand,
      };
      const result = await executeControlledTests(selectedRepoId, payload);
      setTestResults(result);
      saveSessionState({ testResults: result });
      if (result.status === 'PASS') {
        setSuccessMsg(`Test execution passed (${result.passed || 0}/${result.total || result.passed || 1} passed).`);
      } else {
        setError(`Target test execution failed: ${result.failed || 1} test(s) failed.`);
      }
    } catch (err) {
      setError(err.message || 'Test execution failed.');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleVerifyFix = async () => {
    if (!selectedRepoId || !selectedIssue) return;
    setIsVerifying(true);
    setError('');
    try {
      const verification = await verifyFixResolution(selectedRepoId, {
        originalIssue: selectedIssue,
        repository: selectedRepo?.fullName || selectedRepo?.name,
        targetFile: selectedIssue?.file || paramFilePath,
        testFilePath: generatedSuite?.testFilePath,
        testCode: generatedSuite?.testCode || '',
        testResults: testResults || { status: 'NOT_RUN' },
      });
      setVerificationResult(verification);
      saveSessionState({ verificationResult: verification });
    } catch (err) {
      const msg = err.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE' || err.statusCode === 503
        ? 'AI service is temporarily busy. Please try again in a few moments.'
        : err.message || 'Verification failed.';
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDiagnose = async () => {
    if (!selectedIssue || !testResults) return;
    setIsDiagnosing(true);
    try {
      const diag = await diagnoseTestFailure(selectedRepoId, {
        originalIssue: selectedIssue,
        testOutput: `${testResults.stdout}\n${testResults.stderr}`,
      });
      setDiagnosis(diag.diagnosis);
      saveSessionState({ diagnosis: diag.diagnosis });
    } catch (err) {
      const msg = err.code === 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE' || err.statusCode === 503
        ? 'AI service is temporarily busy. Please try again in a few moments.'
        : 'Diagnosis could not be completed.';
      setDiagnosis(msg);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleRemediate = async () => {
    if (!selectedRepoId || !selectedIssue) return;
    setIsRemediating(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await remediateIssue(selectedRepoId, {
        issueData: {
          issueId: selectedIssue._id || selectedIssue.id || paramIssueId,
          analysisId: selectedIssue.analysis || selectedIssue.analysisId || paramAnalysisId,
          filePath: selectedIssue.file || paramFilePath,
          line: selectedIssue.line,
          description: selectedIssue.description,
          severity: selectedIssue.severity,
          recommendation: selectedIssue.recommendation,
          category: selectedIssue.category,
        },
        testCode: generatedSuite?.testCode,
        testFilePath: generatedSuite?.testFilePath,
        language: selectedRepo?.language || (selectedIssue?.file?.endsWith('.c') ? 'c' : undefined),
        maxRetries: 3,
      });

      if (result.testResults) {
        setTestResults(result.testResults);
        saveSessionState({ testResults: result.testResults });
      }
      if (result.verificationResult) {
        setVerificationResult(result.verificationResult);
        saveSessionState({ verificationResult: result.verificationResult });
      }

      if (result.resolved === 'RESOLVED') {
        const passedCount = result.testResults?.passed || 0;
        const totalCount = result.testResults?.total || result.testResults?.passed || 1;
        setSuccessMsg(`✓ Remediation Verified: AI resolved the root cause and all target tests passed (${passedCount}/${totalCount} passed).`);
      } else {
        setError(`Remediation did not resolve all target tests: ${result.error || 'one or more tests failed'}`);
      }
    } catch (err) {
      setError(err.message || 'Remediation request failed.');
    } finally {
      setIsRemediating(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header with Workflow Navigation Context */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Automation</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Test Suite Generation &amp; Verification</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Automated Tests &amp; Verification
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Generate 4-scenario unit test suites (regression, happy path, edge cases, error handling), commit tests to branch, and critically verify fix resolution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIssue && (
            <Link
              to={`/dashboard/ai-fixes?repositoryId=${selectedRepoId}&issueId=${selectedIssue._id || selectedIssue.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-750 bg-graphite-850 px-3 py-1.5 font-mono text-xs text-mist-300 hover:border-amber-400/40 hover:text-amber-300 transition-colors"
            >
              <span>← Back to AI Fix</span>
            </Link>
          )}

          {repos.length > 0 && (
            <select
              value={selectedRepoId}
              onChange={(e) => {
                const newRepoId = e.target.value;
                setSelectedRepoId(newRepoId);
                setSelectedIssue(null);
                setGeneratedSuite(null);
                setApplyTestResult(null);
                setTestResults(null);
                setVerificationResult(null);
                setSearchParams({ repositoryId: newRepoId }, { replace: true });
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-graphite-750 bg-graphite-800 px-3.5 py-2 text-xs font-semibold text-mist-300 transition-colors hover:bg-graphite-750 hover:text-mist-100 disabled:opacity-50 font-mono"
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
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 font-mono animate-fade-in">
          <span>⚠️ {error}</span>
          <Link
            to={`/dashboard/ai-fixes?repositoryId=${selectedRepoId || ''}`}
            className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
          >
            Return to AI Fixes
          </Link>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-300 font-mono animate-fade-in">
          ✓ {successMsg}
        </div>
      )}

      {/* Main Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Issues / Test Targets List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-mist-300">
                Test Targets ({repoIssues.length})
              </h2>
              {selectedIssue && (
                <span className="text-[10px] font-mono text-purple-400">Target Active</span>
              )}
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {repoIssues.length === 0 ? (
                <p className="text-xs text-mist-500 font-mono italic p-3 text-center">
                  No issues to test in this repository.
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
                          ? 'border-purple-400/60 bg-graphite-800 shadow-sm'
                          : 'border-graphite-800 bg-graphite-850/80 hover:bg-graphite-800 hover:border-graphite-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-purple-300 font-bold uppercase">
                          {issue.category || 'logic'}
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
        </div>

        {/* Right: Test Suite & Verification Workspace */}
        <div className="lg:col-span-8 space-y-4">
          {!selectedIssue ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-750 bg-graphite-900/40 p-6 text-center">
              <span className="text-3xl">🧪</span>
              <h3 className="mt-2 text-sm font-semibold text-mist-100">Select a target to generate tests</h3>
              <p className="mt-1 text-xs text-mist-400 max-w-sm">
                Choose any module on the left or select an issue from AI Fixes to generate a 4-scenario unit test suite.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Target Header Card */}
              <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 pb-2.5">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="text-purple-400 font-bold uppercase">
                        TARGET: {selectedRepo?.fullName || selectedRepo?.name || 'Repository'} / {selectedIssue.file} {selectedIssue.line ? `:${selectedIssue.line}` : ''}
                      </span>
                      {activeBranch && (
                        <span className="rounded bg-graphite-800 border border-graphite-700 px-2 py-0.5 text-amber-300 text-[10px]">
                          Branch: {activeBranch}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-mist-100 mt-1 leading-snug">
                      {selectedIssue.description}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateTests}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 px-4 py-2 text-xs font-semibold text-mist-100 hover:bg-purple-400 disabled:opacity-50 transition-all font-mono shadow-sm"
                    >
                      <span>{isGenerating ? '⏳ Generating Test Suite…' : '🧪 Generate 4-Scenario Tests'}</span>
                    </button>
                  </div>
                </div>

                {selectedIssue.recommendation && (
                  <p className="text-xs text-mist-300 leading-relaxed">
                    <strong className="text-mist-400 font-mono">Context &amp; Remediation:</strong> {selectedIssue.recommendation}
                  </p>
                )}
              </div>

              {/* Generated Test Suite Preview Canvas */}
              {generatedSuite && (
                <div className="rounded-2xl border border-graphite-750 bg-graphite-900/95 shadow-panel overflow-hidden space-y-0 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 px-5 py-3.5 bg-graphite-850/90">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-mist-100">{generatedSuite.testFilePath}</span>
                      <span className="rounded bg-purple-500/20 px-2 py-0.5 text-purple-300 font-semibold text-[11px]">
                        {generatedSuite.framework}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      {!applyTestResult ? (
                        <button
                          onClick={handleApplyTests}
                          disabled={isApplyingTests}
                          className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-graphite-950 hover:bg-amber-300 disabled:opacity-50 shadow-sm transition-all"
                        >
                          <span>{isApplyingTests ? '⏳ Committing Tests…' : '✓ Apply Tests to Repository'}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold text-xs">✓ Tests Committed</span>
                          {applyTestResult.compareUrl && (
                            <a
                              href={applyTestResult.compareUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-emerald-400 px-2.5 py-1 text-[11px] font-bold text-graphite-950 hover:bg-emerald-300"
                            >
                              Compare on GitHub ↗
                            </a>
                          )}
                        </div>
                      )}

                      <button
                        onClick={handleRunTests}
                        disabled={isRunningTests}
                        className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-graphite-950 hover:bg-emerald-300 disabled:opacity-50 shadow-sm transition-all flex items-center gap-1.5"
                      >
                        <span>{isRunningTests ? '⏳ Running…' : '▶ Run Test Runner'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Scenarios Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-graphite-950/80 border-b border-graphite-800 font-mono text-[11px]">
                    {generatedSuite.scenarios?.map((s, idx) => (
                      <div key={idx} className="rounded bg-graphite-900 p-2 text-mist-300 border border-graphite-800">
                        <span className="text-amber-400 font-bold block">{s.name}</span>
                        <span className="text-mist-500 text-[10px]">{s.description}</span>
                      </div>
                    ))}
                  </div>

                  {/* Test Code Viewer */}
                  <pre className="max-h-72 overflow-y-auto bg-graphite-950 p-4 font-mono text-xs text-mist-200 leading-relaxed shadow-inner">
                    {generatedSuite.testCode}
                  </pre>
                </div>
              )}

              {/* Test Execution Results Dashboard */}
              {testResults && (
                <div className="rounded-2xl border border-graphite-750 bg-graphite-900/95 p-5 shadow-panel space-y-4 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-800 pb-3">
                    <div className="flex items-center gap-2 font-mono">
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider border ${
                          testResults.status === 'PASS'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {testResults.status === 'PASS' ? '✓ TEST SUITE PASSED' : '✕ TEST SUITE FAILED'}
                      </span>
                      <span className="rounded bg-graphite-800 border border-graphite-700 px-2 py-0.5 text-xs font-bold text-amber-300">
                        {testResults.passed || 0} / {testResults.total || ((testResults.passed || 0) + (testResults.failed || 0)) || 1} passed
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      {testResults.status === 'FAIL' && (
                        <>
                          <button
                            onClick={handleRemediate}
                            disabled={isRemediating}
                            className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-graphite-950 hover:bg-amber-300 disabled:opacity-50 shadow-sm transition-all"
                          >
                            {isRemediating ? '⏳ Remediating & Verifying…' : '⚡ Remediate Issue with AI'}
                          </button>
                          <button
                            onClick={handleDiagnose}
                            disabled={isDiagnosing || isRemediating}
                            className="rounded-lg bg-amber-400/15 border border-amber-400/40 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-400/25 disabled:opacity-50"
                          >
                            {isDiagnosing ? 'Diagnosing…' : '🔍 Ask AI to Diagnose'}
                          </button>
                        </>
                      )}

                      <button
                        onClick={handleVerifyFix}
                        disabled={isVerifying || isRemediating}
                        className="rounded-lg bg-purple-500 px-3.5 py-1.5 text-xs font-semibold text-mist-100 hover:bg-purple-400 shadow-sm disabled:opacity-50"
                      >
                        {isVerifying ? 'Verifying…' : '🛡️ Verify Fix with AI'}
                      </button>
                    </div>
                  </div>

                  {/* Target Execution Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs bg-graphite-950/70 p-3.5 rounded-xl border border-graphite-800">
                    <div>
                      <span className="text-mist-500 block text-[10px] uppercase font-bold">Repository Under Test</span>
                      <span className="text-mist-100 font-bold truncate block">{testResults.repository || selectedRepo?.fullName || selectedRepo?.name || 'Target Repo'}</span>
                    </div>
                    <div>
                      <span className="text-mist-500 block text-[10px] uppercase font-bold">Target File</span>
                      <span className="text-mist-100 font-bold truncate block">{testResults.targetFile || selectedIssue?.file || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-mist-500 block text-[10px] uppercase font-bold">Language &amp; Runner</span>
                      <span className="text-purple-300 font-bold truncate block">
                        {(testResults.language || 'C').toUpperCase()} &bull; {testResults.runner || 'Target Runner'}
                      </span>
                    </div>
                    <div>
                      <span className="text-mist-500 block text-[10px] uppercase font-bold">Exit Code &amp; Duration</span>
                      <span className="text-mist-100 font-bold block">
                        Code {testResults.exitCode !== undefined ? testResults.exitCode : 0} ({testResults.duration || '0s'})
                      </span>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 border-t border-graphite-800/80 pt-2 mt-1">
                      <span className="text-mist-500 text-[10px] uppercase font-bold mr-2">Execution Command:</span>
                      <code className="text-amber-300 text-[11px] break-all">{testResults.command || 'Target test execution'}</code>
                    </div>
                  </div>

                  {/* Individual Scenario Results if Available */}
                  {Array.isArray(testResults.tests) && testResults.tests.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono uppercase font-bold text-mist-400 block">
                        Test Scenarios ({testResults.tests.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {testResults.tests.map((t, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg p-2.5 border font-mono text-xs flex flex-col justify-between gap-1.5 ${
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

                  {/* Output Console */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase font-bold text-mist-400 block">
                      Target Execution Output:
                    </span>
                    <div className="rounded-xl bg-graphite-950 p-3.5 border border-graphite-800 font-mono text-xs text-mist-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                      {testResults.stdout || testResults.stderr || 'Execution completed with 0 errors.'}
                    </div>
                  </div>

                  {/* AI Diagnosis Panel */}
                  {diagnosis && (
                    <div className="rounded-xl border border-amber-400/30 bg-graphite-950 p-4 space-y-2 font-mono text-xs text-mist-200">
                      <span className="font-bold text-amber-400 block uppercase">
                        AI Root Cause Diagnosis:
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed">{diagnosis}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Verification Agent Result Card */}
              {verificationResult && (
                <div className="rounded-2xl border border-purple-500/40 bg-graphite-900/95 p-5 shadow-panel space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-graphite-800 pb-2.5">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-lg">🛡️</span>
                      <span className="text-xs font-bold text-mist-100 uppercase tracking-wider">
                        Verification Agent Assessment:
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                          verificationResult.resolved === 'RESOLVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {verificationResult.resolved}
                      </span>
                    </div>

                    <Link
                      to={`/dashboard/pull-requests?repositoryId=${selectedRepoId}&branch=${encodeURIComponent(activeBranch || selectedIssue.testBranch || selectedIssue.fixBranch || '')}&issueId=${selectedIssue._id || selectedIssue.id}`}
                      className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 hover:bg-amber-300 transition-all font-mono shadow-sm"
                    >
                      Open Pull Request →
                    </Link>
                  </div>

                  <p className="text-xs sm:text-sm text-mist-200 leading-relaxed font-sans">
                    {verificationResult.reasoning}
                  </p>

                  {verificationResult.remainingRisks && (
                    <div className="text-xs font-mono text-mist-400 pt-1">
                      <strong className="text-amber-400">Remaining Risks:</strong> {verificationResult.remainingRisks}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
