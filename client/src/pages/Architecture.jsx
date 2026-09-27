import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../services/api';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import { fetchGithubRepositories } from '../services/githubService';

const CATEGORIES = [
  { id: 'all', label: 'All Modules', color: '#F5B942' },
  { id: 'routes', label: 'Routes', color: '#38BDF8' },
  { id: 'controllers', label: 'Controllers', color: '#818CF8' },
  { id: 'services', label: 'Services', color: '#F59E0B' },
  { id: 'models', label: 'Models', color: '#10B981' },
  { id: 'components', label: 'Components', color: '#F97316' },
  { id: 'middleware', label: 'Middleware', color: '#A855F7' },
  { id: 'config', label: 'Config', color: '#06B6D4' },
  { id: 'utils', label: 'Utilities', color: '#94A3B8' },
  { id: 'dependencies', label: 'Dependencies', color: '#EC4899' },
];

export default function Architecture() {
  const { repositoryId: urlRepoId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [connectedRepos, setConnectedRepos] = useState([]);
  const [activeRepoId, setActiveRepoId] = useState(urlRepoId || '');
  const [repository, setRepository] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [_summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('Parsing repository files...');
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showDependencies, setShowDependencies] = useState(true);
  const [showSummaryPanel, setShowSummaryPanel] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [isPhysicsPaused, setIsPhysicsPaused] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Measure container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Fetch connected repos if no repo ID is in params
  useEffect(() => {
    if (!urlRepoId) {
      fetchGithubRepositories()
        .then((data) => {
          const connected = (data || []).filter((r) => r.connected);
          setConnectedRepos(connected);
          if (connected.length > 0 && !activeRepoId) {
            setActiveRepoId(connected[0].repositoryId || connected[0]._id);
          }
        })
        .catch(() => {});
    } else {
      setActiveRepoId(urlRepoId);
    }
  }, [urlRepoId, activeRepoId]);

  const loadGraph = useCallback(async () => {
    if (!activeRepoId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    setSelectedNode(null);
    try {
      const { data } = await api.get(`/architecture/${activeRepoId}`);
      if (data.data?.repository) {
        setRepository(data.data.repository);
      }
      if (data.data?.graph?.nodes?.length) {
        setGraphData(data.data.graph);
        setSummary(data.data.summary || data.data.graph.summary || null);
      } else {
        setGraphData(null);
        setSummary(null);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || err.message || 'Failed to load architecture graph.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeRepoId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleAnalyze = async () => {
    if (!activeRepoId) return;
    setIsAnalyzing(true);
    setError('');
    setSelectedNode(null);
    setAnalysisStage('Analyzing repository codebase...');

    const stageTimer1 = setTimeout(() => {
      setAnalysisStage('Extracting imports, route handlers & models...');
    }, 1500);

    const stageTimer2 = setTimeout(() => {
      setAnalysisStage('Building force-directed dependency graph...');
    }, 3500);

    try {
      const { data } = await api.post(`/architecture/${activeRepoId}/analyze`);
      setGraphData(data.data.graph);
      setSummary(data.data.summary || data.data.graph.summary || null);
      if (data.data.repository) {
        setRepository(data.data.repository);
      }
      toast.success('Architecture graph generated successfully.', 'Graph Ready');
      // Auto fit after render
      setTimeout(() => {
        if (fgRef.current) fgRef.current.zoomToFit(600, 40);
      }, 500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to analyze architecture.';
      setError(msg);
      toast.error(msg, 'Analysis Failed');
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsAnalyzing(false);
    }
  };

  // Filter graphData nodes & links based on dependencies toggle
  const activeGraphData = useMemo(() => {
    if (!graphData?.nodes) return { nodes: [], links: [] };

    let nodes = graphData.nodes;
    if (!showDependencies) {
      nodes = nodes.filter((n) => n.category !== 'dependencies' && n.type !== 'dependencies');
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (graphData.links || []).filter((l) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(src) && nodeIds.has(tgt);
    });

    return { nodes, links };
  }, [graphData, showDependencies]);

  // Find neighbors of a node for highlighting
  const neighborsMap = useMemo(() => {
    if (!activeGraphData?.links) return new Map();
    const map = new Map();

    activeGraphData.links.forEach((link) => {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;

      if (!map.has(src)) map.set(src, new Set());
      if (!map.has(tgt)) map.set(tgt, new Set());

      map.get(src).add(tgt);
      map.get(tgt).add(src);
    });

    return map;
  }, [activeGraphData]);

  // Compute incoming and outgoing connections for the selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode || !activeGraphData?.links || !activeGraphData?.nodes) {
      return { incoming: [], outgoing: [] };
    }
    const nodeId = selectedNode.id;
    const nodesById = new Map(activeGraphData.nodes.map((n) => [n.id, n]));

    const incoming = [];
    const outgoing = [];

    activeGraphData.links.forEach((l) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;

      if (sourceId === nodeId) {
        const tgtNode = nodesById.get(targetId);
        outgoing.push(tgtNode || { id: targetId, name: targetId, category: 'misc' });
      }
      if (targetId === nodeId) {
        const srcNode = nodesById.get(sourceId);
        incoming.push(srcNode || { id: sourceId, name: sourceId, category: 'misc' });
      }
    });

    return { incoming, outgoing };
  }, [selectedNode, activeGraphData]);

  // DERIVED ARCHITECTURE SUMMARY: Most Connected Modules & Bottlenecks
  const architectureMetrics = useMemo(() => {
    if (!graphData?.nodes?.length || !graphData?.links?.length) {
      return {
        totalFiles: graphData?.nodes?.length || 0,
        totalDependencies: graphData?.links?.length || 0,
        mostConnected: [],
        potentialBottlenecks: [],
      };
    }

    const inDegreeMap = new Map();
    const outDegreeMap = new Map();

    graphData.links.forEach((l) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;

      outDegreeMap.set(src, (outDegreeMap.get(src) || 0) + 1);
      inDegreeMap.set(tgt, (inDegreeMap.get(tgt) || 0) + 1);
    });

    const enriched = graphData.nodes.map((n) => ({
      id: n.id,
      name: n.name || n.id,
      path: n.path,
      category: n.category || n.type || 'misc',
      color: n.color,
      inDegree: inDegreeMap.get(n.id) || 0,
      outDegree: outDegreeMap.get(n.id) || 0,
      totalCoupling: (inDegreeMap.get(n.id) || 0) + (outDegreeMap.get(n.id) || 0),
    }));

    // Most connected (highest total in + out)
    const mostConnected = [...enriched]
      .sort((a, b) => b.totalCoupling - a.totalCoupling)
      .slice(0, 3);

    // Potential bottlenecks (highest in-degree dependents)
    const potentialBottlenecks = [...enriched]
      .filter((n) => n.inDegree >= 3)
      .sort((a, b) => b.inDegree - a.inDegree)
      .slice(0, 3);

    return {
      totalFiles: graphData.nodes.length,
      totalDependencies: graphData.links.length,
      mostConnected,
      potentialBottlenecks,
    };
  }, [graphData]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(3.5, 600);
    }
  }, []);

  const handleSelectConnectedNode = (targetId) => {
    if (!activeGraphData?.nodes) return;
    const target = activeGraphData.nodes.find((n) => n.id === targetId);
    if (target) {
      handleNodeClick(target);
    }
  };

  const handleZoomIn = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * 1.35, 300);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom / 1.35, 300);
    }
  };

  const handleFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(500, 40);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedNode(null);
    setHoveredNode(null);
    setShowDependencies(true);
    handleFit();
  };

  const togglePhysics = () => {
    if (fgRef.current) {
      if (isPhysicsPaused) {
        fgRef.current.resumeAnimation();
      } else {
        fgRef.current.pauseAnimation();
      }
      setIsPhysicsPaused(!isPhysicsPaused);
    }
  };

  const handleCopyPath = (pathText) => {
    if (!pathText) return;
    navigator.clipboard.writeText(pathText);
    setCopiedPath(true);
    toast.success('File path copied to clipboard.');
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleAskAI = (node) => {
    const targetRepoId = activeRepoId || urlRepoId;
    const query = node
      ? `Explain the architecture, responsibilities, and dependencies of the \`${node.path || node.name}\` module in this codebase.`
      : `Explain the overall modular architecture, core entry points, and structural patterns of this codebase.`;
    navigate(`/dashboard/repositories/${targetRepoId}/chat`, {
      state: { initialMessage: query },
    });
  };

  // Custom Node Canvas Renderer
  const drawNode = useCallback(
    (node, ctx, globalScale) => {
      const isSelected = selectedNode && selectedNode.id === node.id;
      const isHovered = hoveredNode && hoveredNode.id === node.id;
      const activeNode = selectedNode || hoveredNode;

      // Check neighbor highlighting
      let isDimmed = false;
      if (activeNode) {
        const isNeighbor =
          neighborsMap.get(activeNode.id)?.has(node.id) || node.id === activeNode.id;
        if (!isNeighbor) isDimmed = true;
      }

      // Check category and search filtering
      if (selectedCategory !== 'all' && node.category !== selectedCategory && node.type !== selectedCategory) {
        isDimmed = true;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matches =
          node.name?.toLowerCase().includes(q) ||
          node.id?.toLowerCase().includes(q) ||
          node.path?.toLowerCase().includes(q);
        if (!matches) isDimmed = true;
      }

      const nodeVal = node.val || 2;
      const baseRadius = Math.max(3.5, Math.min(10, 2.5 + nodeVal * 1.1));
      const r = (isSelected || isHovered) ? baseRadius * 1.35 : baseRadius;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.18 : 1.0;

      // Glow effect for selected or hovered nodes
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected ? 'rgba(245, 185, 66, 0.35)' : 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = isSelected ? '#F5B942' : '#FFFFFF';
        ctx.stroke();
      }

      // Node base circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color || '#F5B942';
      ctx.fill();

      ctx.lineWidth = 1 / globalScale;
      ctx.strokeStyle = '#0F121C';
      ctx.stroke();

      // Node text label
      const fontSize = Math.max(10 / globalScale, 2.5);
      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const label = node.name || node.id;
      const displayLabel = label.length > 24 ? `${label.slice(0, 22)}…` : label;

      // Draw text pill background for readability
      if (!isDimmed || isSelected || isHovered) {
        const textWidth = ctx.measureText(displayLabel).width;
        const textPadding = 2 / globalScale;
        const textY = node.y + r + 2 / globalScale;

        ctx.fillStyle = 'rgba(15, 18, 28, 0.85)';
        ctx.fillRect(
          node.x - textWidth / 2 - textPadding,
          textY - textPadding / 2,
          textWidth + textPadding * 2,
          fontSize + textPadding
        );

        ctx.fillStyle = isSelected ? '#F5B942' : '#E2E8F0';
        ctx.fillText(displayLabel, node.x, textY);
      }

      ctx.restore();
    },
    [selectedNode, hoveredNode, neighborsMap, selectedCategory, searchQuery]
  );

  // Custom Link Color & Opacity
  const getLinkColor = useCallback(
    (link) => {
      const activeNode = selectedNode || hoveredNode;
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;

      if (activeNode) {
        if (srcId === activeNode.id || tgtId === activeNode.id) {
          return '#F59E0B'; // Highlight connected links in amber
        }
        return 'rgba(50, 60, 85, 0.12)';
      }

      if (selectedCategory !== 'all' || searchQuery.trim()) {
        return 'rgba(70, 80, 110, 0.35)';
      }

      return 'rgba(80, 95, 130, 0.55)';
    },
    [selectedNode, hoveredNode, selectedCategory, searchQuery]
  );

  const getLinkWidth = useCallback(
    (link) => {
      const activeNode = selectedNode || hoveredNode;
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;

      if (activeNode && (srcId === activeNode.id || tgtId === activeNode.id)) {
        return 2.2;
      }
      return 1;
    },
    [selectedNode, hoveredNode]
  );

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col space-y-2.5 pb-1">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 border-b border-graphite-800 pb-3">
        <div>
          {/* Breadcrumb & Repo Header */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dashboard/repositories"
              className="text-xs font-mono text-mist-400 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              <span>Repositories</span>
              <span>/</span>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-mist-100 flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>{repository?.fullName || repository?.name || 'Architecture Visualization'}</span>
            </h1>

            {/* Standalone Repo Switcher Dropdown */}
            {connectedRepos.length > 1 && !urlRepoId && (
              <select
                value={activeRepoId}
                onChange={(e) => setActiveRepoId(e.target.value)}
                className="rounded-lg border border-graphite-750 bg-graphite-850 px-2.5 py-1 text-xs font-mono text-mist-200 outline-none focus:border-amber-400 ml-1"
              >
                {connectedRepos.map((r) => (
                  <option key={r.repositoryId || r.githubId} value={r.repositoryId || r._id}>
                    {r.fullName || r.name}
                  </option>
                ))}
              </select>
            )}

            {repository?.defaultBranch && (
              <span className="rounded-full border border-graphite-700 bg-graphite-800 px-2 py-0.5 text-[10px] font-mono text-mist-300">
                ⑂ {repository.defaultBranch}
              </span>
            )}

            {graphData?.nodes && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-mono text-amber-400 font-semibold">
                {activeGraphData.nodes.length} modules · {activeGraphData.links.length} links
              </span>
            )}
          </div>
          <p className="text-xs text-mist-400 mt-1">
            Force-directed modular dependency graph mapped from route definitions, controllers, models, and imports.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Explain with AI Action */}
          <button
            onClick={() => handleAskAI(selectedNode)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition-colors shadow-sm"
            title="Explain repository architecture with AI"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Explain with AI</span>
          </button>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !activeRepoId}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 disabled:opacity-50 active:scale-95 shadow-sm"
            title="Re-scan codebase and rebuild architecture graph"
          >
            <svg
              className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>{isAnalyzing ? 'Analyzing…' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 font-mono shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={handleAnalyze}
            className="rounded-lg bg-rose-500/20 px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/30 transition-colors"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {/* Secondary Filter & Search Bar */}
      {graphData?.nodes?.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 bg-graphite-900/60 p-2 rounded-xl border border-graphite-800">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search module, file path, or category…"
              className="w-full rounded-lg border border-graphite-750 bg-graphite-950 px-3 py-1.5 pl-8 text-xs text-mist-100 placeholder:text-mist-500 focus:border-amber-400 outline-none transition-colors"
            />
            <svg
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-mist-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-mist-400 hover:text-mist-100"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls: Dependencies Toggle & Summary Toggle */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowDependencies(!showDependencies)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                showDependencies
                  ? 'bg-graphite-800 text-mist-200 border-graphite-700'
                  : 'bg-amber-400/10 text-amber-400 border-amber-400/30 font-semibold'
              }`}
              title="Toggle third-party external package nodes"
            >
              {showDependencies ? '📦 Dependencies: ON' : '📦 Dependencies: OFF'}
            </button>

            <button
              onClick={() => setShowSummaryPanel(!showSummaryPanel)}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-graphite-800 text-mist-300 border border-graphite-700 hover:text-mist-100"
            >
              {showSummaryPanel ? 'Hide Summary' : 'Show Summary'}
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-thin">
            {CATEGORIES.map((cat) => {
              const count =
                cat.id === 'all'
                  ? activeGraphData.nodes.length
                  : activeGraphData.nodes.filter((n) => n.category === cat.id || n.type === cat.id).length;

              if (cat.id !== 'all' && count === 0) return null;

              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-graphite-950 font-semibold shadow-sm'
                      : 'bg-graphite-800 text-mist-300 hover:bg-graphite-750 hover:text-mist-100 border border-graphite-750'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: isSelected ? '#000000' : cat.color }}
                  />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-black/20 text-black' : 'bg-graphite-700 text-mist-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-2xl border border-graphite-750 bg-[#090B10] shadow-panel"
      >
        {isAnalyzing ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-4 animate-fade-in">
            <div className="relative h-16 w-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
              <div className="h-10 w-10 rounded-full bg-amber-400/10 flex items-center justify-center border border-amber-400/30">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
            </div>
            <div className="max-w-md space-y-1.5">
              <p className="font-mono text-sm sm:text-base font-semibold text-amber-400">
                {analysisStage}
              </p>
              <p className="text-xs text-mist-400 leading-relaxed">
                Analyzing AST syntax trees, module exports, route structures, and third-party dependencies.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-center space-y-3">
            <span className="h-7 w-7 rounded-full border-2 border-graphite-700 border-t-amber-400 animate-spin" />
            <p className="font-mono text-xs text-mist-400">Loading module topology…</p>
          </div>
        ) : !graphData || !graphData.nodes?.length ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={
                <svg className="h-7 w-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              }
              title="No architecture graph generated yet"
              description="Analyze this repository to generate an interactive visualization of components, routes, database schemas, and service relationships."
              actionLabel="Generate Architecture Graph"
              onAction={handleAnalyze}
            />
          </div>
        ) : (
          <div className="relative h-full w-full">
            {/* Top Toolbar Controls */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1 rounded-xl border border-graphite-700 bg-graphite-900/90 p-1.5 shadow-2xl backdrop-blur-md">
              <button
                onClick={handleZoomIn}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-graphite-800 text-mist-300 hover:bg-graphite-750 hover:text-mist-100 transition-colors text-sm font-bold"
                title="Zoom In"
                aria-label="Zoom In"
              >
                +
              </button>

              <button
                onClick={handleZoomOut}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-graphite-800 text-mist-300 hover:bg-graphite-750 hover:text-mist-100 transition-colors text-sm font-bold"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                −
              </button>

              <button
                onClick={handleFit}
                className="flex h-7 items-center px-2.5 rounded-lg bg-graphite-800 text-xs font-mono text-mist-300 hover:bg-graphite-750 hover:text-mist-100 transition-colors"
                title="Fit to screen"
              >
                Fit
              </button>

              <div className="h-4 w-[1px] bg-graphite-700 mx-0.5" />

              <button
                onClick={handleResetFilters}
                className="flex h-7 items-center px-2 rounded-lg bg-graphite-800 text-xs font-mono text-mist-400 hover:bg-graphite-750 hover:text-mist-100 transition-colors"
                title="Reset selection & filters"
              >
                Reset
              </button>

              <button
                onClick={togglePhysics}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-mono transition-colors ${
                  isPhysicsPaused
                    ? 'bg-amber-400 text-graphite-950 font-bold'
                    : 'bg-graphite-800 text-mist-300 hover:bg-graphite-750 hover:text-mist-100'
                }`}
                title={isPhysicsPaused ? 'Resume graph physics' : 'Freeze graph layout'}
              >
                {isPhysicsPaused ? '▶' : '⏸'}
              </button>
            </div>

            {/* Architecture Summary Bar (Derived Data) */}
            {showSummaryPanel && (
              <div className="absolute top-4 left-56 z-20 hidden lg:flex items-center gap-3 rounded-xl border border-graphite-700 bg-graphite-900/90 px-3.5 py-1.5 shadow-2xl backdrop-blur-md text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-mist-500">Files:</span>
                  <span className="font-bold text-mist-100">{architectureMetrics.totalFiles}</span>
                </div>
                <span className="text-graphite-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-mist-500">Dependencies:</span>
                  <span className="font-bold text-mist-100">{architectureMetrics.totalDependencies}</span>
                </div>
                {architectureMetrics.mostConnected.length > 0 && (
                  <>
                    <span className="text-graphite-700">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-mist-500">Top Connected:</span>
                      <span className="font-bold text-amber-400">{architectureMetrics.mostConnected[0].name}</span>
                    </div>
                  </>
                )}
                {architectureMetrics.potentialBottlenecks.length > 0 && (
                  <>
                    <span className="text-graphite-700">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-rose-400">Bottlenecks:</span>
                      <span className="font-bold text-rose-400">{architectureMetrics.potentialBottlenecks.length}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Bottom-left Interactive Legend */}
            <div className="absolute bottom-4 left-4 z-20 hidden sm:block">
              {showLegend ? (
                <div className="flex flex-col gap-2 rounded-xl border border-graphite-700 bg-graphite-900/95 p-3.5 shadow-2xl backdrop-blur-md max-w-xs animate-scale-in">
                  <div className="flex items-center justify-between gap-2 border-b border-graphite-800 pb-2">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-mist-400">
                      Module Categories
                    </span>
                    <button
                      onClick={() => setShowLegend(false)}
                      className="text-xs text-mist-400 hover:text-mist-100"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {CATEGORIES.filter((c) => c.id !== 'all').map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedCategory(selectedCategory === item.id ? 'all' : item.id)}
                        className={`flex items-center gap-1.5 text-[11px] font-mono text-left truncate transition-colors ${
                          selectedCategory === item.id ? 'text-amber-400 font-semibold' : 'text-mist-300 hover:text-mist-100'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowLegend(true)}
                  className="rounded-lg border border-graphite-700 bg-graphite-900/90 px-3 py-1.5 text-xs font-mono text-mist-400 hover:text-mist-100 shadow-xl backdrop-blur-md"
                >
                  Show Legend
                </button>
              )}
            </div>

            {/* Selected Module Details Inspector Drawer */}
            {selectedNode && (
              <div className="absolute top-4 right-4 z-30 w-84 max-w-[calc(100vw-2rem)] max-h-[calc(100%-2rem)] flex flex-col rounded-2xl border border-graphite-700 bg-graphite-900/95 p-4 shadow-2xl backdrop-blur-md animate-scale-in overflow-y-auto">
                <div className="flex items-start justify-between gap-2 border-b border-graphite-800 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-graphite-950"
                        style={{ backgroundColor: selectedNode.color || '#F5B942' }}
                      >
                        {selectedNode.category || selectedNode.type || 'Module'}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-mono text-sm font-bold text-mist-100 truncate" title={selectedNode.name}>
                      {selectedNode.name || selectedNode.id}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="rounded-lg p-1 text-mist-400 hover:bg-graphite-800 hover:text-mist-100 transition-colors"
                    aria-label="Close Inspector"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mt-3 space-y-3 text-xs">
                  {/* Description */}
                  {selectedNode.description && (
                    <div className="rounded-lg bg-graphite-850 p-2.5 border border-graphite-800 text-mist-300 leading-relaxed text-[11px]">
                      {selectedNode.description}
                    </div>
                  )}

                  {/* File Path with Copy Action */}
                  {selectedNode.path && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-mist-500 mb-1">
                        <span>File Path</span>
                        <button
                          onClick={() => handleCopyPath(selectedNode.path)}
                          className="text-amber-400 hover:underline"
                        >
                          {copiedPath ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="rounded-lg bg-graphite-950 p-2 font-mono text-[11px] text-mist-200 break-all border border-graphite-800">
                        {selectedNode.path}
                      </div>
                    </div>
                  )}

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="rounded-lg bg-graphite-850 p-2 border border-graphite-800">
                      <span className="text-mist-500 block text-[10px] uppercase">Imports Out</span>
                      <span className="text-mist-100 font-bold text-sm">{selectedNodeConnections.outgoing.length}</span>
                    </div>
                    <div className="rounded-lg bg-graphite-850 p-2 border border-graphite-800">
                      <span className="text-mist-500 block text-[10px] uppercase">Imported By</span>
                      <span className="text-mist-100 font-bold text-sm">{selectedNodeConnections.incoming.length}</span>
                    </div>
                  </div>

                  {/* Outgoing Imports List */}
                  {selectedNodeConnections.outgoing.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-mist-400 block font-semibold">
                        Imports ({selectedNodeConnections.outgoing.length})
                      </span>
                      <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-graphite-800 bg-graphite-950/60 p-1.5 scrollbar-thin">
                        {selectedNodeConnections.outgoing.map((tgt) => (
                          <button
                            key={tgt.id}
                            onClick={() => handleSelectConnectedNode(tgt.id)}
                            className="w-full flex items-center justify-between rounded-md p-1.5 text-left text-[11px] font-mono text-mist-300 hover:bg-graphite-800 hover:text-amber-400 transition-colors"
                          >
                            <span className="truncate">{tgt.name || tgt.id}</span>
                            <span className="text-mist-500 text-[10px]">→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Incoming Consumers List */}
                  {selectedNodeConnections.incoming.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-mist-400 block font-semibold">
                        Imported By ({selectedNodeConnections.incoming.length})
                      </span>
                      <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-graphite-800 bg-graphite-950/60 p-1.5 scrollbar-thin">
                        {selectedNodeConnections.incoming.map((src) => (
                          <button
                            key={src.id}
                            onClick={() => handleSelectConnectedNode(src.id)}
                            className="w-full flex items-center justify-between rounded-md p-1.5 text-left text-[11px] font-mono text-mist-300 hover:bg-graphite-800 hover:text-amber-400 transition-colors"
                          >
                            <span className="truncate">{src.name || src.id}</span>
                            <span className="text-mist-500 text-[10px]">←</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="space-y-2 border-t border-graphite-800 pt-3">
                    <button
                      onClick={() => handleAskAI(selectedNode)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-graphite-950 transition-all hover:bg-amber-300 shadow-sm active:scale-95"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>Explain with AI</span>
                    </button>

                    {repository?.htmlUrl && selectedNode.path && !selectedNode.path.startsWith('node_modules') && (
                      <a
                        href={`${repository.htmlUrl}/blob/${repository.defaultBranch || 'main'}/${selectedNode.path}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-graphite-750 bg-graphite-850 px-3 py-1.5 text-xs font-mono text-mist-300 hover:bg-graphite-800 hover:text-mist-100 transition-colors"
                      >
                        <span>View Source on GitHub</span>
                        <span className="text-xs">↗</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2D Force Graph Canvas */}
            <ForceGraph2D
              ref={fgRef}
              graphData={activeGraphData}
              nodeCanvasObject={drawNode}
              nodePointerAreaPaint={(node, color, ctx) => {
                const r = Math.max(5, (node.val || 2) * 2);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                ctx.fill();
              }}
              onNodeClick={handleNodeClick}
              onNodeHover={(node) => setHoveredNode(node || null)}
              onBackgroundClick={() => setSelectedNode(null)}
              linkColor={getLinkColor}
              linkWidth={getLinkWidth}
              linkDirectionalArrowLength={4.5}
              linkDirectionalArrowRelPos={1}
              linkDirectionalParticles={1.5}
              linkDirectionalParticleSpeed={0.006}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleColor={() => '#F59E0B'}
              backgroundColor="#090B10"
              width={dimensions.width}
              height={dimensions.height}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              cooldownTicks={120}
            />
          </div>
        )}
      </div>
    </div>
  );
}
