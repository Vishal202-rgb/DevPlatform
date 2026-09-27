import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { StatCardSkeleton } from '../components/Skeleton';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { fetchGithubRepositories } from '../services/githubService';
import { calculateImpact, fetchImpactFiles } from '../services/impactService';
import api from '../services/api';

export default function ImpactAnalysis() {
  const [repos, setRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [analyzableFiles, setAnalyzableFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [targetSymbol, setTargetSymbol] = useState('');
  const [impactResult, setImpactResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [error, setError] = useState('');

  const [isGeneratingArch, setIsGeneratingArch] = useState(false);

  const loadRepos = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const repoRes = await fetchGithubRepositories().catch(() => []);
      const connected = (repoRes || []).filter((r) => r.connected);
      setRepos(connected);

      if (connected.length > 0 && !selectedRepoId) {
        setSelectedRepoId(connected[0].repositoryId || connected[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load repositories.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRepoId]);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  // Load files list and graph when selectedRepoId changes
  useEffect(() => {
    if (!selectedRepoId) return;

    setIsLoadingGraph(true);
    setImpactResult(null);

    fetchImpactFiles(selectedRepoId)
      .then((files) => {
        setAnalyzableFiles(files || []);
        if (files?.length > 0) {
          setSelectedFile((prev) => (files.some((f) => f.path === prev) ? prev : files[0].path));
        }
      })
      .catch(() => {
        setAnalyzableFiles([]);
      })
      .finally(() => {
        setIsLoadingGraph(false);
      });
  }, [selectedRepoId]);

  const handleGenerateArchitecture = async () => {
    if (!selectedRepoId || isGeneratingArch) return;
    setIsGeneratingArch(true);
    setError('');
    try {
      await api.post(`/architecture/${selectedRepoId}/analyze`);
      const files = await fetchImpactFiles(selectedRepoId);
      setAnalyzableFiles(files || []);
      if (files?.length > 0) {
        setSelectedFile(files[0].path);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate architecture graph.');
    } finally {
      setIsGeneratingArch(false);
    }
  };

  const handleRunImpactAnalysis = async (filePathToAnalyze = selectedFile) => {
    const target = filePathToAnalyze || selectedFile;
    if (!selectedRepoId || !target) return;

    setIsAnalyzing(true);
    setError('');
    try {
      const result = await calculateImpact(selectedRepoId, target, targetSymbol);
      setImpactResult(result);
    } catch (err) {
      setError(err.message || 'Failed to calculate impact analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskBadgeColor = (riskLevel) => {
    switch (riskLevel?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-graphite-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-mist-400">
            <span>Engineering</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">Blast Radius &amp; Ripple Effects</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100 mt-1">
            Impact Analysis
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-mist-400">
            Select any file or symbol to compute exact downstream dependencies, affected APIs, tests, and AI risk explanation.
          </p>
        </div>

        {repos.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-mist-400">Repository:</span>
            <select
              value={selectedRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setSelectedFile('');
              }}
              className="rounded-lg border border-graphite-750 bg-graphite-900 px-3 py-1.5 font-mono text-xs text-mist-100 outline-none focus:border-amber-400"
            >
              {repos.map((r) => (
                <option key={r.repositoryId || r.githubId} value={r.repositoryId || r._id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-300 font-mono">
          {error}
        </div>
      )}

      {/* Target Component Selector & Run Card */}
      <div className="rounded-2xl border border-graphite-750 bg-graphite-900/90 p-5 shadow-panel space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
            🎯 Target Component Selection
          </h2>
          <span className="text-[11px] font-mono text-mist-400">
            {isLoadingGraph
              ? 'Loading dependency graph…'
              : `${analyzableFiles.length} files available in dependency graph`}
          </span>
        </div>

        {isLoadingGraph ? (
          <div className="py-6 text-center text-xs font-mono text-mist-400 animate-pulse">
            Loading repository files from architecture graph…
          </div>
        ) : analyzableFiles.length === 0 ? (
          <div className="rounded-xl border border-graphite-750 bg-graphite-850 p-4 text-center space-y-3">
            <p className="text-xs font-mono text-mist-400">
              Architecture graph not generated yet.
            </p>
            <button
              onClick={handleGenerateArchitecture}
              disabled={isGeneratingArch}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-graphite-950 hover:bg-amber-300 transition-colors font-mono disabled:opacity-50"
            >
              <span>{isGeneratingArch ? '⏳ Generating Architecture Graph…' : '⚡ Generate Architecture'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-mono uppercase text-mist-400">
                Source File / Module
              </label>
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="w-full rounded-xl border border-graphite-750 bg-graphite-850 px-3.5 py-2.5 font-mono text-xs text-mist-100 outline-none focus:border-amber-400"
              >
                {analyzableFiles.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.path} ({f.category}) - {f.inDegree || 0} callers
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono uppercase text-mist-400">
                Symbol Name (Optional)
              </label>
              <input
                type="text"
                value={targetSymbol}
                onChange={(e) => setTargetSymbol(e.target.value)}
                placeholder="e.g. loginUser, AuthModal"
                className="w-full rounded-xl border border-graphite-750 bg-graphite-850 px-3.5 py-2.5 font-mono text-xs text-mist-100 outline-none focus:border-amber-400 placeholder:text-mist-600"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-graphite-800">
          <p className="text-xs text-mist-400">
            Calculates direct callers, transitive reverse dependencies, affected routes, and test suites.
          </p>
          <button
            onClick={() => handleRunImpactAnalysis()}
            disabled={isAnalyzing || !selectedFile || analyzableFiles.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 disabled:opacity-50 shadow-sm active:scale-95 font-mono"
          >
            <span>{isAnalyzing ? '⏳ Computing Blast Radius…' : '⚡ Explain Impact with AI'}</span>
          </button>
        </div>
      </div>

      {/* Impact Results Panel */}
      {impactResult && (
        <div className="space-y-5 animate-fade-in">
          {/* Summary KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
              <span className="text-[11px] font-mono uppercase tracking-wider text-mist-400 block">
                Target File
              </span>
              <p className="mt-1 font-mono text-xs font-bold text-mist-100 truncate" title={impactResult.targetPath}>
                {impactResult.targetPath}
              </p>
              {impactResult.targetSymbol && (
                <span className="mt-1 inline-block rounded bg-graphite-800 px-1.5 py-0.5 text-[10px] font-mono text-amber-400">
                  Symbol: {impactResult.targetSymbol}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block font-semibold">
                Directly Affected
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-amber-400">
                  {impactResult.directDependents?.length || 0}
                </span>
                <span className="text-xs text-mist-400 font-mono">files</span>
              </div>
            </div>

            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
              <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 block font-semibold">
                Indirectly Affected
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-purple-400">
                  {impactResult.indirectDependents?.length || 0}
                </span>
                <span className="text-xs text-mist-400 font-mono">downstream</span>
              </div>
            </div>

            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
              <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 block font-semibold">
                Potential APIs &amp; Tests
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-sky-300">
                  {impactResult.affectedRoutes?.length || 0} APIs / {impactResult.affectedTests?.length || 0} Tests
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 shadow-panel">
              <span className="text-[11px] font-mono uppercase tracking-wider text-mist-400 block">
                Calculated Risk
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-bold uppercase tracking-wider border ${getRiskBadgeColor(impactResult.riskLevel)}`}>
                  {impactResult.riskLevel} ({impactResult.riskScore}/100)
                </span>
              </div>
            </div>
          </div>

          {/* Symbol Notice Banner */}
          {impactResult.symbolNotice && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-xs font-mono text-amber-300/90 flex items-center gap-2">
              <span>ℹ️</span>
              <span>{impactResult.symbolNotice}</span>
            </div>
          )}

          {/* AI Explanation Box */}
          {impactResult.aiExplanation && (
            <div className="rounded-2xl border border-amber-400/30 bg-graphite-900/95 p-5 shadow-panel space-y-3">
              <div className="flex items-center gap-2 border-b border-graphite-800 pb-3">
                <span className="text-base">🤖</span>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                  AI Architectural Impact Explanation &amp; Verification Plan
                </h3>
              </div>
              <div className="text-xs sm:text-sm leading-relaxed text-mist-200">
                <MarkdownRenderer content={impactResult.aiExplanation} />
              </div>
            </div>
          )}

          {/* Affected Files Breakdown Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Direct Dependents */}
            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-mist-300 flex items-center justify-between">
                <span>Directly Affected Files ({impactResult.directDependents?.length || 0})</span>
                <span className="text-[10px] text-mist-500 font-normal">Immediate callers</span>
              </h3>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {impactResult.directDependents?.length === 0 ? (
                  <p className="text-xs text-mist-500 font-mono italic">No direct dependents found.</p>
                ) : (
                  impactResult.directDependents?.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedFile(f.path);
                        handleRunImpactAnalysis(f.path);
                      }}
                      className="w-full flex items-center justify-between rounded-lg bg-graphite-850 px-3 py-2 text-left font-mono text-xs text-mist-200 hover:bg-graphite-800 hover:text-amber-400 transition-colors group"
                    >
                      <span className="truncate">{f.path}</span>
                      <span className="rounded bg-graphite-800 px-1.5 py-0.5 text-[10px] text-mist-400 uppercase shrink-0 ml-2 group-hover:text-amber-400">
                        {f.category} →
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Indirect Dependents */}
            <div className="rounded-xl border border-graphite-750 bg-graphite-900/90 p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-mist-300 flex items-center justify-between">
                <span>Indirect Downstream Files ({impactResult.indirectDependents?.length || 0})</span>
                <span className="text-[10px] text-mist-500 font-normal">Transitive cascade</span>
              </h3>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {impactResult.indirectDependents?.length === 0 ? (
                  <p className="text-xs text-mist-500 font-mono italic">No indirect dependents found.</p>
                ) : (
                  impactResult.indirectDependents?.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedFile(f.path);
                        handleRunImpactAnalysis(f.path);
                      }}
                      className="w-full flex items-center justify-between rounded-lg bg-graphite-850 px-3 py-2 text-left font-mono text-xs text-mist-200 hover:bg-graphite-800 hover:text-purple-300 transition-colors group"
                    >
                      <span className="truncate">{f.path}</span>
                      <span className="rounded bg-graphite-800 px-1.5 py-0.5 text-[10px] text-mist-400 uppercase shrink-0 ml-2 group-hover:text-purple-300">
                        {f.category} →
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Coupling Table */}
      <div className="space-y-4 pt-4 border-t border-graphite-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400 font-mono">
            Repository Coupling &amp; In-Degree Rank
          </h2>

          {selectedRepoId && (
            <Link
              to={`/dashboard/repositories/${selectedRepoId}/architecture`}
              className="text-xs font-mono text-amber-400 hover:underline"
            >
              Open 2D Force Graph →
            </Link>
          )}
        </div>

        {isLoading || isLoadingGraph ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : !analyzableFiles.length ? (
          <EmptyState
            icon="🗺️"
            title="No architecture data for this repository"
            description="Generate an architecture graph for this repository to compute module dependencies, in-degree coupling, and change blast radius."
            actionLabel={selectedRepoId ? "Generate Architecture" : "Connect Repositories"}
            actionLink={selectedRepoId ? `/dashboard/repositories/${selectedRepoId}/architecture` : "/dashboard/repositories"}
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-graphite-750 bg-graphite-900/90 shadow-panel">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="border-b border-graphite-800 bg-graphite-850/80 font-mono text-[11px] uppercase tracking-wider text-mist-400">
                <tr>
                  <th className="px-4 py-3.5">Module Path</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Dependents (In-Degree)</th>
                  <th className="px-4 py-3.5">Dependencies (Out-Degree)</th>
                  <th className="px-4 py-3.5 text-right">Quick Analysis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800/80 font-mono">
                {analyzableFiles.map((m) => (
                  <tr key={m.path} className="hover:bg-graphite-850/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-mist-100">{m.path}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-graphite-800 px-2 py-0.5 text-[11px] text-mist-300 border border-graphite-700 uppercase">
                        {m.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-bold ${(m.inDegree || 0) >= 4 ? 'text-rose-400' : (m.inDegree || 0) >= 2 ? 'text-amber-400' : 'text-mist-200'}`}>
                        {m.inDegree || 0} modules
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-mist-300">
                      {m.outDegree || 0} imports
                    </td>
                    <td className="px-4 py-3.5 text-right font-sans">
                      <button
                        onClick={() => {
                          setSelectedFile(m.path);
                          handleRunImpactAnalysis(m.path);
                        }}
                        className="rounded-lg border border-graphite-700 bg-graphite-800 px-2.5 py-1 text-xs text-mist-300 hover:text-amber-400 hover:border-amber-400/40 transition-colors font-mono"
                      >
                        Analyze Impact →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
