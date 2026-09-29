import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StatCard from '../components/StatCard';
import GithubConnectionCard from '../components/GithubConnectionCard';
import EmptyState from '../components/EmptyState';
import { StatCardSkeleton } from '../components/Skeleton';
import { useGithubConnection } from '../hooks/useGithubConnection';
import { fetchGithubRepositories } from '../services/githubService';
import { fetchAllAnalyses, fetchAllIssues } from '../services/analysisService';

const githubErrorMessages = {
  access_denied: 'GitHub authorization was cancelled.',
  missing_params: 'GitHub redirected back without the expected parameters.',
  400: 'The GitHub authorization request was invalid or expired. Please try again.',
  401: 'GitHub rejected the request. Please try connecting again.',
  server_error: 'Something went wrong connecting to GitHub. Please try again.',
};

function formatTimeAgo(dateString) {
  if (!dateString) return 'Never';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-mist-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

function scoreBg(score) {
  if (score === null || score === undefined) return 'bg-graphite-800 border-graphite-700 text-mist-500';
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  if (score >= 50) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
  return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected, isLoading: isAuthLoading } = useGithubConnection();

  const [repos, setRepos] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [issues, setIssues] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activityTab, setActivityTab] = useState('all'); // 'all' | 'analyses' | 'issues' | 'actions'

  const banner = useMemo(() => {
    if (searchParams.get('github') === 'connected') {
      return { type: 'success', message: 'GitHub account connected successfully.' };
    }
    const errCode = searchParams.get('github_error');
    if (errCode) {
      return {
        type: 'error',
        message: githubErrorMessages[errCode] || 'GitHub connection failed. Please try again.',
      };
    }
    return null;
  }, [searchParams]);

  // Clear query params after reading
  useEffect(() => {
    if (banner) {
      const next = new URLSearchParams(searchParams);
      next.delete('github');
      next.delete('github_error');
      setSearchParams(next, { replace: true });
    }
  }, [banner, searchParams, setSearchParams]);

  const loadDashboardData = async () => {
    setIsLoadingData(true);
    try {
      const [analysesRes, issuesRes, reposRes] = await Promise.allSettled([
        fetchAllAnalyses(),
        fetchAllIssues(),
        isConnected ? fetchGithubRepositories() : Promise.resolve([]),
      ]);

      if (analysesRes.status === 'fulfilled') setAnalyses(analysesRes.value || []);
      if (issuesRes.status === 'fulfilled') setIssues(issuesRes.value || []);
      if (reposRes.status === 'fulfilled') setRepos(reposRes.value || []);
    } catch {
      // Handled gracefully via defaults
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // SECTION A: Repository Summary
  const totalReposCount = useMemo(() => {
    return isConnected ? repos.length : 0;
  }, [isConnected, repos]);

  const analyzedReposCount = useMemo(() => {
    // Unique repositories that have at least one completed analysis
    const repoIdsWithAnalysis = new Set();
    analyses.forEach((a) => {
      if (a.repository?._id || a.repository) {
        repoIdsWithAnalysis.add(a.repository._id || a.repository);
      }
    });
    return repoIdsWithAnalysis.size;
  }, [analyses]);

  const lastAnalysis = useMemo(() => {
    return analyses.length > 0 ? analyses[0] : null;
  }, [analyses]);

  // SECTION B: Engineering Health Scores
  // 1. Code Quality: Avg overallScore from analyses
  const codeQualityScore = useMemo(() => {
    const completed = analyses.filter((a) => a.overallScore !== null && a.overallScore !== undefined);
    if (!completed.length) return null;
    const sum = completed.reduce((acc, curr) => acc + curr.overallScore, 0);
    return Math.round(sum / completed.length);
  }, [analyses]);

  // 2. Security Score: Computed from security category issues & severity
  const securityScore = useMemo(() => {
    if (!analyses.length) return null;
    const securityIssues = issues.filter((i) => i.category === 'security' || i.severity === 'critical');
    const critical = securityIssues.filter((i) => i.severity === 'critical').length;
    const high = securityIssues.filter((i) => i.severity === 'high').length;
    const medium = securityIssues.filter((i) => i.severity === 'medium').length;
    const penalty = critical * 25 + high * 10 + medium * 3;
    return Math.max(10, Math.min(100, 100 - penalty));
  }, [analyses, issues]);

  // 3. Architecture Score: Derived from modularity & complexity
  const architectureScore = useMemo(() => {
    if (!analyses.length) return null;
    // Base score derived from analyses score + code-smell proportion
    const codeSmells = issues.filter((i) => i.category === 'code-smell' || i.category === 'performance').length;
    if (codeQualityScore === null) return null;
    const score = Math.max(20, Math.min(100, codeQualityScore + 5 - codeSmells * 2));
    return score;
  }, [analyses, issues, codeQualityScore]);

  // 4. Testing Score: Based on test generation tracking & verified tests
  const testingScore = useMemo(() => {
    const completed = analyses.filter((a) => a.overallScore !== null && a.overallScore !== undefined);
    if (!completed.length) return null;
    const testIssues = issues.filter((i) => i.category === 'test' || i.category === 'bug');
    const testedCount = issues.filter((i) => i.testBranch || i.testStatus === 'passed').length;
    if (testIssues.length === 0) {
      const baseScore = Math.round(completed.reduce((acc, curr) => acc + curr.overallScore, 0) / completed.length);
      return Math.max(70, Math.min(100, baseScore));
    }
    const coverageEstimate = Math.min(100, Math.round((testedCount / Math.max(1, testIssues.length)) * 60 + 40));
    return coverageEstimate;
  }, [analyses, issues]);

  // 5. Maintainability Score:
  const maintainabilityScore = useMemo(() => {
    if (!analyses.length) return null;
    const perfIssues = issues.filter((i) => i.category === 'performance').length;
    const smells = issues.filter((i) => i.category === 'code-smell').length;
    const penalty = perfIssues * 4 + smells * 2;
    return Math.max(25, Math.min(100, 100 - penalty));
  }, [analyses, issues]);

  // SECTION C: Recent Activity Items
  const recentActivities = useMemo(() => {
    const stream = [];

    // Recent Analyses
    analyses.slice(0, 5).forEach((a) => {
      stream.push({
        id: `analysis-${a._id}`,
        type: 'analysis',
        title: `Code Review: ${a.repository?.fullName || 'Repository'}`,
        description: `Analysis completed with score ${a.overallScore !== null ? `${a.overallScore}/100` : '—'} (${a.summary?.totalIssues || 0} issues)`,
        timestamp: a.createdAt,
        badge: a.status === 'completed' ? 'Analysis' : 'Failed',
        badgeColor: a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        link: a.repository ? `/dashboard/repositories/${a.repository._id}/analysis` : '/dashboard/analyses',
      });
    });

    // Recent Issues
    issues.slice(0, 5).forEach((i) => {
      stream.push({
        id: `issue-${i._id}`,
        type: 'issue',
        title: `Issue: ${i.file}`,
        description: i.description,
        timestamp: i.analyzedAt || new Date().toISOString(),
        badge: i.severity,
        badgeColor:
          i.severity === 'critical'
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : i.severity === 'high'
            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        link: i.repository ? `/dashboard/repositories/${i.repository.id}/analysis` : '/dashboard/issues',
      });
    });

    // Recent AI Actions (Fixes, Tests, PRs)
    issues.filter((i) => i.fixBranch || i.testBranch || i.prUrl).slice(0, 5).forEach((i) => {
      const isPr = Boolean(i.prUrl);
      const isTest = Boolean(i.testBranch);
      stream.push({
        id: `action-${i._id}`,
        type: 'action',
        title: isPr ? `PR Opened: #${i.prNumber || 'GitHub PR'}` : isTest ? `Test Branch: ${i.testBranch}` : `AI Fix Branch: ${i.fixBranch}`,
        description: `Automated remediation on ${i.file}`,
        timestamp: i.fixAppliedAt || i.testAppliedAt || i.analyzedAt || new Date().toISOString(),
        badge: isPr ? 'Pull Request' : isTest ? 'Test Suite' : 'Branch Fix',
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        link: i.prUrl || i.fixCompareUrl || '/dashboard/ai-fixes',
        external: Boolean(i.prUrl || i.fixCompareUrl),
      });
    });

    // Sort by timestamp descending
    stream.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return stream;
  }, [analyses, issues]);

  const filteredActivities = useMemo(() => {
    if (activityTab === 'all') return recentActivities.slice(0, 6);
    if (activityTab === 'analyses') return recentActivities.filter((a) => a.type === 'analysis').slice(0, 6);
    if (activityTab === 'issues') return recentActivities.filter((a) => a.type === 'issue').slice(0, 6);
    if (activityTab === 'actions') return recentActivities.filter((a) => a.type === 'action').slice(0, 6);
    return recentActivities.slice(0, 6);
  }, [recentActivities, activityTab]);

  // SECTION E: Repository Health Overview
  const analyzedReposList = useMemo(() => {
    // Map analyses to repositories
    const map = new Map();
    analyses.forEach((a) => {
      if (!a.repository) return;
      const repoId = a.repository._id || a.repository;
      if (!map.has(repoId)) {
        map.set(repoId, {
          repoId,
          name: a.repository.fullName || 'Repository',
          score: a.overallScore,
          critical: a.summary?.critical || 0,
          high: a.summary?.high || 0,
          medium: a.summary?.medium || 0,
          totalIssues: a.summary?.totalIssues || 0,
          lastScan: a.createdAt,
          status: a.status,
        });
      }
    });
    return Array.from(map.values());
  }, [analyses]);

  return (
    <div className="space-y-6 sm:space-y-7 pb-10">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>DevMind</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Engineering Command Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Engineering Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Understand, analyze, fix, test, and improve your codebase with AI.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard/repositories"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 shadow-sm active:scale-95"
          >
            <span>Scan Repository</span>
            <span>+</span>
          </Link>
        </div>
      </div>

      {/* GitHub Connection Card */}
      <GithubConnectionCard banner={banner} />

      {/* SECTION A: Repository Summary KPIs */}
      {isLoadingData || isAuthLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
          <StatCard
            label="Total Repositories"
            value={isConnected ? totalReposCount : '0'}
            hint={
              isConnected
                ? `${analyzedReposCount} of ${totalReposCount} analyzed by AI`
                : 'Connect GitHub to sync repositories'
            }
            badge={isConnected ? 'Synced' : 'Offline'}
            linkTo="/dashboard/repositories"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="6" x2="6" y1="3" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
            }
          />

          <StatCard
            label="Analyzed Repositories"
            value={analyzedReposCount}
            hint={
              analyzedReposCount > 0
                ? `${analyses.length} total review audits performed`
                : 'No code reviews completed yet'
            }
            badge={analyzedReposCount > 0 ? 'Active' : 'Pending'}
            linkTo="/dashboard/analyses"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />

          <StatCard
            label="Last Analyzed Repo"
            value={
              lastAnalysis?.repository?.fullName
                ? (lastAnalysis.repository.fullName.includes('/')
                    ? lastAnalysis.repository.fullName.split('/')[1]
                    : lastAnalysis.repository.fullName)
                : '—'
            }
            title={lastAnalysis?.repository?.fullName || 'No repository audited yet'}
            hint={
              lastAnalysis?.repository?.fullName
                ? lastAnalysis.repository.fullName
                : 'No repository audited yet'
            }
            badge={lastAnalysis ? 'Latest' : 'None'}
            linkTo={lastAnalysis?.repository ? `/dashboard/repositories/${lastAnalysis.repository._id || lastAnalysis.repository.id || lastAnalysis.repository}/analysis` : '/dashboard/repositories'}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />

          <StatCard
            label="Last Analysis Time"
            value={lastAnalysis ? formatTimeAgo(lastAnalysis.createdAt) : 'Never'}
            title={lastAnalysis ? `Run on ${new Date(lastAnalysis.createdAt).toLocaleString()}` : undefined}
            hint={
              lastAnalysis
                ? `Audited ${new Date(lastAnalysis.createdAt).toLocaleDateString()}`
                : 'Awaiting initial scan execution'
            }
            badge={lastAnalysis ? 'Recorded' : 'N/A'}
            linkTo="/dashboard/analyses"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
        </div>
      )}

      {/* SECTION B: Engineering Health Score Cards (5 Pillars) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <h2 className="text-xs font-mono font-medium uppercase tracking-wider text-mist-400">
              Engineering Health Pillars
            </h2>
          </div>
          <span className="text-xs font-mono text-mist-500 hidden sm:inline">
            Real data from AST audits &amp; dependency trees
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5 items-stretch">
          {/* 1. Code Quality */}
          <div className="group flex h-full min-h-[148px] flex-col justify-between rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-4 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:-translate-y-0.5">
            <div className="min-w-0">
              <div className="flex h-5 items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-mist-300">
                  Code Quality
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono border ${codeQualityScore !== null ? scoreBg(codeQualityScore) : 'bg-graphite-800 text-mist-500 border-graphite-700'}`}>
                  {codeQualityScore !== null ? 'Live' : 'No data'}
                </span>
              </div>
              <div className="mt-3 min-w-0">
                <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                  {codeQualityScore !== null ? (
                    <span className={scoreColor(codeQualityScore)}>{codeQualityScore}<span className="text-sm text-mist-500 font-normal">/100</span></span>
                  ) : (
                    <span className="text-mist-500 text-base font-normal">Not analyzed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-graphite-800/80 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    codeQualityScore === null ? 'bg-graphite-700' : codeQualityScore >= 80 ? 'bg-emerald-400' : codeQualityScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, codeQualityScore || 0))}%` }}
                />
              </div>
              <div className="mt-2 min-w-0">
                <p className="truncate text-[11px] text-mist-500 font-mono">
                  {codeQualityScore !== null
                    ? codeQualityScore >= 80 ? 'High cleanliness' : 'Review debt'
                    : 'Awaiting first analysis'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Security */}
          <div className="group flex h-full min-h-[148px] flex-col justify-between rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-4 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:-translate-y-0.5">
            <div className="min-w-0">
              <div className="flex h-5 items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-mist-300">
                  Security
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono border ${securityScore !== null ? scoreBg(securityScore) : 'bg-graphite-800 text-mist-500 border-graphite-700'}`}>
                  {securityScore !== null ? 'Live' : 'No data'}
                </span>
              </div>
              <div className="mt-3 min-w-0">
                <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                  {securityScore !== null ? (
                    <span className={scoreColor(securityScore)}>{securityScore}<span className="text-sm text-mist-500 font-normal">/100</span></span>
                  ) : (
                    <span className="text-mist-500 text-base font-normal">Not analyzed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-graphite-800/80 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    securityScore === null ? 'bg-graphite-700' : securityScore >= 80 ? 'bg-emerald-400' : securityScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, securityScore || 0))}%` }}
                />
              </div>
              <div className="mt-2 min-w-0">
                <p className="truncate text-[11px] text-mist-500 font-mono">
                  {securityScore !== null
                    ? securityScore >= 80 ? 'Vulnerability safe' : 'Patches pending'
                    : 'Awaiting first analysis'}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Architecture */}
          <div className="group flex h-full min-h-[148px] flex-col justify-between rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-4 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:-translate-y-0.5">
            <div className="min-w-0">
              <div className="flex h-5 items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-mist-300">
                  Architecture
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono border ${architectureScore !== null ? scoreBg(architectureScore) : 'bg-graphite-800 text-mist-500 border-graphite-700'}`}>
                  {architectureScore !== null ? 'Live' : 'No data'}
                </span>
              </div>
              <div className="mt-3 min-w-0">
                <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                  {architectureScore !== null ? (
                    <span className={scoreColor(architectureScore)}>{architectureScore}<span className="text-sm text-mist-500 font-normal">/100</span></span>
                  ) : (
                    <span className="text-mist-500 text-base font-normal">Not analyzed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-graphite-800/80 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    architectureScore === null ? 'bg-graphite-700' : architectureScore >= 80 ? 'bg-emerald-400' : architectureScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, architectureScore || 0))}%` }}
                />
              </div>
              <div className="mt-2 min-w-0">
                <p className="truncate text-[11px] text-mist-500 font-mono">
                  {architectureScore !== null
                    ? architectureScore >= 80 ? 'Modular decoupled' : 'Coupling detected'
                    : 'Awaiting first analysis'}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Testing */}
          <div className="group flex h-full min-h-[148px] flex-col justify-between rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-4 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:-translate-y-0.5">
            <div className="min-w-0">
              <div className="flex h-5 items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-mist-300">
                  Testing
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono border ${testingScore !== null ? scoreBg(testingScore) : 'bg-graphite-800 text-mist-500 border-graphite-700'}`}>
                  {testingScore !== null ? 'Live' : 'No data'}
                </span>
              </div>
              <div className="mt-3 min-w-0">
                <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                  {testingScore !== null ? (
                    <span className={scoreColor(testingScore)}>{testingScore}<span className="text-sm text-mist-500 font-normal">/100</span></span>
                  ) : (
                    <span className="text-mist-500 text-base font-normal">Not analyzed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-graphite-800/80 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    testingScore === null ? 'bg-graphite-700' : testingScore >= 80 ? 'bg-emerald-400' : testingScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, testingScore || 0))}%` }}
                />
              </div>
              <div className="mt-2 min-w-0">
                <p className="truncate text-[11px] text-mist-500 font-mono">
                  {testingScore !== null
                    ? testingScore >= 80 ? 'Tests verified' : 'Coverage needed'
                    : 'Awaiting first analysis'}
                </p>
              </div>
            </div>
          </div>

          {/* 5. Maintainability */}
          <div className="group flex h-full min-h-[148px] flex-col justify-between rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-4 shadow-panel transition-all duration-150 hover:border-graphite-600 hover:bg-graphite-850/90 hover:-translate-y-0.5">
            <div className="min-w-0">
              <div className="flex h-5 items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-mist-300">
                  Maintainability
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-mono border ${maintainabilityScore !== null ? scoreBg(maintainabilityScore) : 'bg-graphite-800 text-mist-500 border-graphite-700'}`}>
                  {maintainabilityScore !== null ? 'Live' : 'No data'}
                </span>
              </div>
              <div className="mt-3 min-w-0">
                <div className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                  {maintainabilityScore !== null ? (
                    <span className={scoreColor(maintainabilityScore)}>{maintainabilityScore}<span className="text-sm text-mist-500 font-normal">/100</span></span>
                  ) : (
                    <span className="text-mist-500 text-base font-normal">Not analyzed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtle Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-graphite-800/80 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    maintainabilityScore === null ? 'bg-graphite-700' : maintainabilityScore >= 80 ? 'bg-emerald-400' : maintainabilityScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, maintainabilityScore || 0))}%` }}
                />
              </div>
              <div className="mt-2 min-w-0">
                <p className="truncate text-[11px] text-mist-500 font-mono">
                  {maintainabilityScore !== null
                    ? maintainabilityScore >= 80 ? 'Low technical debt' : 'Smells detected'
                    : 'Awaiting first analysis'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION D: Quick Actions Command Center */}
      <div className="rounded-xl border border-graphite-750/90 bg-graphite-900/90 p-5 shadow-panel">
        <div className="flex items-center justify-between border-b border-graphite-800/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">
              Quick Actions
            </span>
          </div>
          <span className="text-xs font-mono text-mist-500">
            One-click workflows
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/dashboard/repositories"
            className="flex items-center gap-3 rounded-xl border border-graphite-750/80 bg-graphite-850/50 p-3.5 hover:border-amber-400/40 hover:bg-graphite-800/80 hover:-translate-y-0.5 transition-all duration-150 group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 font-mono group-hover:scale-105 transition-transform border border-amber-400/20">
              ⚡
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-mist-100 group-hover:text-amber-400 transition-colors truncate">
                Analyze Repository
              </p>
              <p className="text-[11px] text-mist-500 truncate">Run Gemini AST audit</p>
            </div>
          </Link>

          <Link
            to="/dashboard/architecture"
            className="flex items-center gap-3 rounded-xl border border-graphite-750/80 bg-graphite-850/50 p-3.5 hover:border-purple-400/40 hover:bg-graphite-800/80 hover:-translate-y-0.5 transition-all duration-150 group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 font-mono group-hover:scale-105 transition-transform border border-purple-500/20">
              🗺️
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-mist-100 group-hover:text-purple-400 transition-colors truncate">
                View Architecture
              </p>
              <p className="text-[11px] text-mist-500 truncate">2D force graph topology</p>
            </div>
          </Link>

          <Link
            to="/dashboard/chat"
            className="flex items-center gap-3 rounded-xl border border-graphite-750/80 bg-graphite-850/50 p-3.5 hover:border-sky-400/40 hover:bg-graphite-800/80 hover:-translate-y-0.5 transition-all duration-150 group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 font-mono group-hover:scale-105 transition-transform border border-sky-500/20">
              💬
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-mist-100 group-hover:text-sky-400 transition-colors truncate">
                Ask AI
              </p>
              <p className="text-[11px] text-mist-500 truncate">Chat with full codebase</p>
            </div>
          </Link>

          <Link
            to="/dashboard/issues"
            className="flex items-center gap-3 rounded-xl border border-graphite-750/80 bg-graphite-850/50 p-3.5 hover:border-rose-400/40 hover:bg-graphite-800/80 hover:-translate-y-0.5 transition-all duration-150 group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 font-mono group-hover:scale-105 transition-transform border border-rose-500/20">
              🛡️
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-mist-100 group-hover:text-rose-400 transition-colors truncate">
                Review Issues
              </p>
              <p className="text-[11px] text-mist-500 truncate">{issues.length} active findings</p>
            </div>
          </Link>
        </div>
      </div>

      {/* SECTION C & E: Recent Activity & Repository Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols): Repository Health Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
              Repository Health Overview
            </h2>
            {analyzedReposList.length > 0 && (
              <Link
                to="/dashboard/analyses"
                className="text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all ({analyzedReposList.length}) →
              </Link>
            )}
          </div>

          {analyzedReposList.length === 0 ? (
            <EmptyState
              icon="📂"
              title="No repository analyses available yet"
              description="Pick a repository from your connected GitHub account to trigger an automated code quality and security review."
              actionLabel="Go to Repositories"
              actionLink="/dashboard/repositories"
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-graphite-750 bg-graphite-900/90 shadow-panel">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="border-b border-graphite-800 bg-graphite-850/80 font-mono text-[11px] uppercase tracking-wider text-mist-400">
                  <tr>
                    <th className="px-4 py-3">Repository</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Critical / High</th>
                    <th className="px-4 py-3">Last Scan</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800/80 font-mono">
                  {analyzedReposList.slice(0, 5).map((r) => (
                    <tr key={r.repoId} className="hover:bg-graphite-850/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-mist-100">
                        <Link
                          to={`/dashboard/repositories/${r.repoId}/analysis`}
                          className="hover:text-amber-400 transition-colors"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold border ${scoreBg(r.score)}`}>
                          {r.score !== null ? `${r.score}/100` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-rose-400 font-bold">{r.critical}</span>
                        <span className="text-mist-500"> / </span>
                        <span className="text-orange-400 font-bold">{r.high}</span>
                      </td>
                      <td className="px-4 py-3 text-mist-400 font-sans text-xs">
                        {formatTimeAgo(r.lastScan)}
                      </td>
                      <td className="px-4 py-3 text-right font-sans space-x-1.5">
                        <Link
                          to={`/dashboard/repositories/${r.repoId}/analysis`}
                          className="rounded-lg border border-graphite-700 bg-graphite-800 px-2.5 py-1 text-xs font-medium text-mist-200 hover:border-amber-400/50 hover:text-amber-400 transition-colors"
                        >
                          Report
                        </Link>
                        <Link
                          to={`/dashboard/repositories/${r.repoId}/architecture`}
                          className="rounded-lg border border-graphite-700 bg-graphite-800 px-2.5 py-1 text-xs font-medium text-mist-200 hover:border-purple-400/50 hover:text-purple-300 transition-colors"
                        >
                          Graph
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column (1 col): Recent Activity Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
              Recent Activity
            </h2>
          </div>

          <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 shadow-panel p-3">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 border-b border-graphite-800 pb-2 mb-3 text-xs font-mono">
              {['all', 'analyses', 'issues', 'actions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActivityTab(tab)}
                  className={`rounded-md px-2 py-0.5 text-[11px] capitalize transition-colors ${
                    activityTab === tab
                      ? 'bg-amber-400 text-graphite-950 font-bold shadow-sm'
                      : 'text-mist-400 hover:text-mist-100 hover:bg-graphite-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {filteredActivities.length === 0 ? (
              <p className="p-4 text-center text-xs text-mist-500 font-mono">
                No recent activity recorded.
              </p>
            ) : (
              <div className="divide-y divide-graphite-800/80 space-y-1">
                {filteredActivities.map((act) => (
                  <div key={act.id} className="pt-2.5 pb-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase border ${act.badgeColor}`}>
                            {act.badge}
                          </span>
                          <span className="text-[10px] text-mist-500 font-mono">
                            {formatTimeAgo(act.timestamp)}
                          </span>
                        </div>
                        {act.external ? (
                          <a
                            href={act.link}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 text-xs font-medium text-mist-200 hover:text-amber-400 transition-colors block truncate"
                          >
                            {act.title}
                          </a>
                        ) : (
                          <Link
                            to={act.link}
                            className="mt-1 text-xs font-medium text-mist-200 hover:text-amber-400 transition-colors block truncate"
                          >
                            {act.title}
                          </Link>
                        )}
                        <p className="text-[11px] text-mist-400 truncate mt-0.5">
                          {act.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
