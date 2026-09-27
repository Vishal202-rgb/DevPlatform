import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { TableRowSkeleton } from '../components/Skeleton';
import CreatePrModal from '../components/CreatePrModal';
import { fetchAllIssues } from '../services/analysisService';
import { fetchGithubRepositories } from '../services/githubService';

export default function PullRequests() {
  const [searchParams] = useSearchParams();
  const paramRepoId = searchParams.get('repositoryId');
  const paramIssueId = searchParams.get('issueId');
  const paramBranch = searchParams.get('branch');

  const [issues, setIssues] = useState([]);
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(paramRepoId || '');
  const [activePrIssue, setActivePrIssue] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIssues = async () => {
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
      
      const targetRepoId = paramRepoId || (connected.length > 0 ? (connected[0].repositoryId || connected[0]._id) : '');
      if (targetRepoId && (!selectedRepoId || selectedRepoId !== targetRepoId)) {
        setSelectedRepoId(targetRepoId);
      }

      // If user came from Tests or AI Fixes with a specific issueId, automatically prepare PR modal
      if (paramIssueId && fetchedIssues.length > 0) {
        const matchingIssue = fetchedIssues.find((i) => i._id === paramIssueId || i.id === paramIssueId);
        if (matchingIssue) {
          // If branch was passed, ensure issue carries it
          if (paramBranch && !matchingIssue.testBranch && !matchingIssue.fixBranch) {
            matchingIssue.testBranch = paramBranch;
          }
          setActivePrIssue(matchingIssue);
          setIsModalOpen(true);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load Pull Requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [paramRepoId, paramIssueId]);

  const repoIssues = useMemo(() => {
    if (!selectedRepoId) return issues;
    return issues.filter(
      (i) =>
        i.repository?._id === selectedRepoId ||
        i.repository?.id === selectedRepoId ||
        i.repository === selectedRepoId
    );
  }, [issues, selectedRepoId]);

  const prList = useMemo(() => {
    return repoIssues.filter((i) => i.prStatus === 'created' || i.prUrl || i.prNumber);
  }, [repoIssues]);

  const readyForPrList = useMemo(() => {
    return repoIssues.filter((i) => (i.fixBranch || i.testBranch) && !i.prUrl);
  }, [repoIssues]);

  const handleOpenPrModal = (issue) => {
    setActivePrIssue(issue);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            {paramRepoId && (
              <>
                <Link
                  to={`/dashboard/tests?repositoryId=${encodeURIComponent(paramRepoId)}${paramIssueId ? `&issueId=${encodeURIComponent(paramIssueId)}` : ''}`}
                  className="text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1 font-semibold"
                >
                  ← Back to Tests
                </Link>
                <span>/</span>
              </>
            )}
            <span>Automation</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">GitHub PR Readiness &amp; Creation</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Pull Requests &amp; Branch Releases
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Automated PR creation with verified Markdown descriptions, test status, impact summaries, and security gate approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {repos.length > 0 && (
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
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
            onClick={loadIssues}
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
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* PR Readiness Checklist KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
          <span className="text-[11px] font-mono uppercase tracking-wider text-mist-400 block">
            Opened Pull Requests
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {prList.length}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-mist-500 font-mono">
            Active PRs on GitHub
          </p>
        </div>

        <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block font-semibold">
            Ready for PR Submission
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">
              {readyForPrList.length}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-mist-500 font-mono">
            Branches with applied fixes/tests
          </p>
        </div>

        <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
          <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 block font-semibold">
            Verification Standard
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-purple-300">
              5 Checkpoints
            </span>
          </div>
          <p className="mt-1 text-[11px] text-mist-500 font-mono">
            Diff, tests, security, impact, AI signoff
          </p>
        </div>

        <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
          <span className="text-[11px] font-mono uppercase tracking-wider text-mist-400 block">
            Git Safety Protocol
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold font-mono text-emerald-400">
              Isolated Branches
            </span>
          </div>
          <p className="mt-1 text-[11px] text-mist-500 font-mono">
            Zero direct commits to main
          </p>
        </div>
      </div>

      {/* Ready to Submit Table */}
      {readyForPrList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
            ⚡ Branches Ready for PR Creation ({readyForPrList.length})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-graphite-750 bg-graphite-900/90 shadow-panel">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="border-b border-graphite-800 bg-graphite-850/80 font-mono text-[11px] uppercase tracking-wider text-mist-400">
                <tr>
                  <th className="px-4 py-3">File / Target</th>
                  <th className="px-4 py-3">Branch Name</th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800/80 font-mono">
                {readyForPrList.map((issue) => (
                  <tr key={issue._id} className="hover:bg-graphite-850/60 transition-colors">
                    <td className="px-4 py-3 text-mist-100 font-semibold">{issue.file}</td>
                    <td className="px-4 py-3 text-amber-300">{issue.fixBranch || issue.testBranch}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-graphite-800 px-2 py-0.5 text-[10px] uppercase text-mist-300 border border-graphite-700">
                        {issue.fixBranch ? 'Fix Patch' : 'Test Suite'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenPrModal(issue)}
                        className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-graphite-950 hover:bg-amber-300 transition-all font-mono shadow-sm"
                      >
                        Create Pull Request →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Opened Pull Requests List */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
          Opened GitHub Pull Requests ({prList.length})
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        ) : prList.length === 0 ? (
          <EmptyState
            icon="🔀"
            title="No pull requests opened yet"
            description="When you apply a fix or test suite, you can generate a verified PR description and open a GitHub Pull Request with one click."
            actionLabel="View AI Fixes"
            actionLink="/dashboard/ai-fixes"
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-graphite-750 bg-graphite-900/90 shadow-panel">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="border-b border-graphite-800 bg-graphite-850/80 font-mono text-[11px] uppercase tracking-wider text-mist-400">
                <tr>
                  <th className="px-4 py-3.5">PR Number</th>
                  <th className="px-4 py-3.5">Target File</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">GitHub Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800/80 font-mono">
                {prList.map((pr, i) => (
                  <tr key={pr._id || i} className="hover:bg-graphite-850/60 transition-colors">
                    <td className="px-4 py-3.5 text-emerald-400 font-bold">
                      #{pr.prNumber || 'PR'}
                    </td>
                    <td className="px-4 py-3.5 text-mist-300">
                      {pr.file}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                        Open on GitHub
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-sans">
                      {pr.prUrl && (
                        <a
                          href={pr.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1 text-xs font-semibold text-graphite-950 hover:bg-amber-300 transition-colors shadow-sm font-mono"
                        >
                          <span>View on GitHub ↗</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && activePrIssue && (
        <CreatePrModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          analysisId={activePrIssue.analysis || activePrIssue.analysisId}
          issue={activePrIssue}
          branchType={activePrIssue.fixBranch ? 'fix' : 'test'}
          onPrCreated={() => {
            setIsModalOpen(false);
            loadIssues();
          }}
        />
      )}
    </div>
  );
}
