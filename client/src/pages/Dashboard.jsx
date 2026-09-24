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

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-mist-400';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected, isLoading: isAuthLoading } = useGithubConnection();

  const [repos, setRepos] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [issues, setIssues] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

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

  // KPI Calculations
  const connectedReposCount = useMemo(() => {
    return repos.filter((r) => r.connected).length;
  }, [repos]);

  const codeHealthScore = useMemo(() => {
    const completed = analyses.filter((a) => a.overallScore !== null && a.overallScore !== undefined);
    if (!completed.length) return null;
    const sum = completed.reduce((acc, curr) => acc + curr.overallScore, 0);
    return Math.round(sum / completed.length);
  }, [analyses]);

  const criticalIssuesCount = useMemo(() => {
    return issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
  }, [issues]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
            Platform Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Real-time code health metrics, AI security audits, and connected repositories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/repositories"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 shadow-sm active:scale-95"
          >
            <span>Scan Repository</span>
            <span>+</span>
          </Link>
        </div>
      </div>

      {/* GitHub Connection Card */}
      <GithubConnectionCard banner={banner} />

      {/* KPI Cards Grid */}
      {isLoadingData || isAuthLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Repositories"
            value={isConnected ? repos.length : '0'}
            hint={
              isConnected
                ? `${connectedReposCount} of ${repos.length} active for analysis`
                : 'Connect GitHub to sync repositories'
            }
            badge={isConnected ? 'Live' : 'Offline'}
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
            label="Analyses Run"
            value={analyses.length}
            hint={
              analyses.length > 0
                ? `Latest: ${new Date(analyses[0].createdAt).toLocaleDateString()}`
                : 'No code reviews run yet'
            }
            badge={analyses.length > 0 ? 'AI Powered' : 'Idle'}
            linkTo="/dashboard/analyses"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />

          <StatCard
            label="Total Issues"
            value={issues.length}
            hint={
              issues.length > 0
                ? `${criticalIssuesCount} critical / high severity`
                : 'No issues detected across repos'
            }
            accent={criticalIssuesCount > 0}
            badge={criticalIssuesCount > 0 ? `${criticalIssuesCount} urgent` : 'Clean'}
            linkTo="/dashboard/issues"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            }
          />

          <StatCard
            label="Avg Code Health"
            value={codeHealthScore !== null ? `${codeHealthScore}/100` : '—'}
            hint={
              codeHealthScore !== null
                ? codeHealthScore >= 80
                  ? 'Strong repository posture'
                  : codeHealthScore >= 50
                  ? 'Moderate review debt'
                  : 'Requires refactoring'
                : 'Awaiting first completed scan'
            }
            badge={
              codeHealthScore !== null
                ? codeHealthScore >= 80
                  ? 'Optimal'
                  : codeHealthScore >= 50
                  ? 'Fair'
                  : 'Low'
                : 'N/A'
            }
            linkTo="/dashboard/analyses"
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Recent Analyses (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
              Recent Code Reviews
            </h2>
            {analyses.length > 0 && (
              <Link
                to="/dashboard/analyses"
                className="text-xs font-mono text-amber-400 hover:underline"
              >
                View all ({analyses.length}) →
              </Link>
            )}
          </div>

          {analyses.length === 0 ? (
            <EmptyState
              icon="⚡"
              title="No analyses conducted yet"
              description="Pick a repository from your connected GitHub account to trigger an automated Gemini code review."
              actionLabel="Go to Repositories"
              actionLink="/dashboard/repositories"
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
              <div className="divide-y divide-graphite-700/60">
                {analyses.slice(0, 5).map((a) => (
                  <div
                    key={a._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-graphite-850/50 transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {a.repository ? (
                          <Link
                            to={`/dashboard/repositories/${a.repository._id}/analysis`}
                            className="font-mono text-sm font-semibold text-mist-100 hover:text-amber-400 transition-colors truncate"
                          >
                            {a.repository.fullName}
                          </Link>
                        ) : (
                          <span className="text-mist-500 font-mono text-sm">Archived Repo</span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${
                            a.status === 'completed'
                              ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-mist-500">
                        {a.filesAnalyzed || 0} files analyzed · Reviewed on {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-mono text-mist-500 block">Score</span>
                        <span className={`font-mono text-base font-bold ${scoreColor(a.overallScore)}`}>
                          {a.overallScore ?? '—'}
                        </span>
                      </div>

                      {a.repository && (
                        <Link
                          to={`/dashboard/repositories/${a.repository._id}/analysis`}
                          className="rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-mist-200 hover:border-amber-400/50 hover:text-amber-400 transition-colors"
                        >
                          Details →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Quick Workflows & System Info (1 col) */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
            AI Workflows
          </h2>

          <div className="space-y-3">
            <Link
              to="/dashboard/repositories"
              className="flex items-start gap-3.5 rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-panel transition-all hover:border-graphite-600 hover:bg-graphite-850/60 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400 font-mono text-sm border border-amber-400/20 group-hover:scale-105 transition-transform">
                AI
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mist-100 group-hover:text-amber-400 transition-colors">
                  Run Gemini Code Analysis
                </p>
                <p className="mt-0.5 text-xs text-mist-400 leading-relaxed">
                  Audit AST for vulnerabilities, bugs, and performance regressions.
                </p>
              </div>
            </Link>

            <Link
              to="/dashboard/repositories"
              className="flex items-start gap-3.5 rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-panel transition-all hover:border-graphite-600 hover:bg-graphite-850/60 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 font-mono text-sm border border-sky-500/20 group-hover:scale-105 transition-transform">
                💬
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mist-100 group-hover:text-sky-400 transition-colors">
                  Chat with Codebase
                </p>
                <p className="mt-0.5 text-xs text-mist-400 leading-relaxed">
                  Query repository logic, dependencies, and implementation details.
                </p>
              </div>
            </Link>

            <Link
              to="/dashboard/repositories"
              className="flex items-start gap-3.5 rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-panel transition-all hover:border-graphite-600 hover:bg-graphite-850/60 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 font-mono text-sm border border-purple-500/20 group-hover:scale-105 transition-transform">
                🕸
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mist-100 group-hover:text-purple-400 transition-colors">
                  Interactive Architecture
                </p>
                <p className="mt-0.5 text-xs text-mist-400 leading-relaxed">
                  Visualize 2D force-directed module graph and import trees.
                </p>
              </div>
            </Link>

            <Link
              to="/dashboard/system-health"
              className="flex items-start gap-3.5 rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-panel transition-all hover:border-graphite-600 hover:bg-graphite-850/60 group"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-sm border border-emerald-500/20 group-hover:scale-105 transition-transform">
                ✓
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-mist-100 group-hover:text-emerald-400 transition-colors">
                  Environment Diagnostics
                </p>
                <p className="mt-0.5 text-xs text-mist-400 leading-relaxed">
                  Verify OAuth callback, MongoDB latency, and Gemini API keys.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
