import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import api from '../services/api';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';

const MODULE_LEGEND = [
  { label: 'Routes / API', color: '#38BDF8' },
  { label: 'Services / Core', color: '#F59E0B' },
  { label: 'Models / DB', color: '#10B981' },
  { label: 'Middleware', color: '#A855F7' },
  { label: 'Components / UI', color: '#F97316' },
  { label: 'Utilities / Misc', color: '#94A3B8' },
];

export default function Architecture() {
  const { repositoryId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  const containerRef = useRef(null);
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Dynamically measure container dimensions
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

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/architecture/${repositoryId}`);
      if (data.data?.graph?.nodes?.length) {
        setGraphData(data.data.graph);
      } else {
        setGraphData(null);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.message || 'Failed to load architecture graph.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError('');
    setSelectedNode(null);
    try {
      const { data } = await api.post(`/architecture/${repositoryId}/analyze`);
      setGraphData(data.data.graph);
      toast.success('Architecture graph mapped successfully.', 'Graph Ready');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to analyze architecture.';
      setError(msg);
      toast.error(msg, 'Analysis Failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(4, 800);
    }
  }, []);

  const handleZoomIn = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * 1.3, 400);
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom / 1.3, 400);
    }
  };

  const handleFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 30);
    }
  };

  // Compute incoming and outgoing connections for selected node
  const nodeConnections = useCallback(() => {
    if (!selectedNode || !graphData?.links) return { incoming: [], outgoing: [] };
    const nodeId = selectedNode.id;

    const incoming = [];
    const outgoing = [];

    graphData.links.forEach((l) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;

      if (sourceId === nodeId) {
        outgoing.push(targetId);
      }
      if (targetId === nodeId) {
        incoming.push(sourceId);
      }
    });

    return { incoming, outgoing };
  }, [selectedNode, graphData]);

  const { incoming, outgoing } = nodeConnections();

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col space-y-3">
      {/* Top Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
              Architecture Graph
            </h1>
            {graphData?.nodes && (
              <span className="rounded-full border border-graphite-700 bg-graphite-800 px-2 py-0.5 text-[10px] font-mono text-mist-400">
                {graphData.nodes.length} modules · {graphData.links?.length || 0} links
              </span>
            )}
          </div>
          <p className="text-xs text-mist-400">
            Interactive 2D force-directed simulation of module imports and system boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/repositories"
            className="text-xs font-mono text-mist-400 hover:text-amber-400 transition-colors"
          >
            ← Repositories
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
          <span>{error}</span>
          <button
            onClick={loadGraph}
            className="rounded bg-red-500/20 px-2 py-1 font-semibold text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Canvas Container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden rounded-xl border border-graphite-700 bg-[#0A0D14] shadow-panel"
      >
        {isAnalyzing ? (
          <div className="flex h-full flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="relative h-12 w-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
              <span className="text-lg">🕸</span>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-amber-400">
                Parsing AST dependencies…
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-mist-400">
                Gemini is tracing file imports, route handlers, and database models.
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="h-6 w-6 rounded-full border-2 border-mist-500 border-t-amber-400 animate-spin mb-3" />
            <p className="font-mono text-xs text-mist-400">Loading module topology…</p>
          </div>
        ) : !graphData || !graphData.nodes?.length ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon="🕸"
              title="No architecture graph generated yet"
              description="Analyze this repository to generate an interactive graph visualization of all imported components, routes, and services."
              actionLabel="Generate Architecture Graph"
              onAction={handleAnalyze}
            />
          </div>
        ) : (
          <div className="relative h-full w-full">
            {/* Top Toolbar Controls */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-graphite-700 bg-graphite-900/90 p-1.5 shadow-xl backdrop-blur-md">
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-1 rounded-lg border border-graphite-700 bg-graphite-800 px-2.5 py-1 text-xs font-medium text-mist-200 hover:border-amber-400/40 hover:text-amber-400 transition-colors disabled:opacity-50"
                title="Regenerate graph layout"
              >
                <span>⟳</span>
                <span className="hidden sm:inline">Regenerate</span>
              </button>

              <div className="h-4 w-[1px] bg-graphite-700 mx-0.5" />

              <button
                onClick={handleZoomIn}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-graphite-800 text-mist-300 hover:bg-graphite-700 hover:text-mist-100 transition-colors text-sm font-bold"
                title="Zoom in"
              >
                +
              </button>

              <button
                onClick={handleZoomOut}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-graphite-800 text-mist-300 hover:bg-graphite-700 hover:text-mist-100 transition-colors text-sm font-bold"
                title="Zoom out"
              >
                −
              </button>

              <button
                onClick={handleFit}
                className="inline-flex items-center gap-1 rounded-lg bg-graphite-800 px-2 py-1 text-xs text-mist-300 hover:bg-graphite-700 hover:text-mist-100 transition-colors"
                title="Fit to view"
              >
                Fit
              </button>
            </div>

            {/* Bottom-left Legend */}
            <div className="absolute bottom-4 left-4 z-20 hidden sm:flex flex-col gap-1.5 rounded-xl border border-graphite-700 bg-graphite-900/90 p-3 shadow-xl backdrop-blur-md max-w-xs">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-mist-500">
                Module Legend
              </span>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {MODULE_LEGEND.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-mist-300">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Selection Details Drawer */}
            {selectedNode && (
              <div className="absolute top-4 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-graphite-700 bg-graphite-900/95 p-4 shadow-2xl backdrop-blur-md animate-scale-in">
                <div className="flex items-start justify-between gap-2 border-b border-graphite-800 pb-2.5">
                  <div className="min-w-0">
                    <span className="rounded bg-graphite-800 px-1.5 py-0.5 font-mono text-[10px] text-amber-400 border border-graphite-700">
                      Selected Module
                    </span>
                    <h3 className="mt-1 font-mono text-sm font-semibold text-mist-100 truncate">
                      {selectedNode.name || selectedNode.id}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="rounded-lg p-1 text-mist-400 hover:bg-graphite-800 hover:text-mist-100"
                    aria-label="Close details"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-3 space-y-2.5 text-xs">
                  {selectedNode.type && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-mist-500 block">Category</span>
                      <span className="font-mono text-mist-200">{selectedNode.type}</span>
                    </div>
                  )}

                  {selectedNode.path && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-mist-500 block">File Path</span>
                      <span className="font-mono text-mist-300 break-all">{selectedNode.path}</span>
                    </div>
                  )}

                  {/* Connected Outgoing & Incoming */}
                  <div className="grid grid-cols-2 gap-2 border-t border-graphite-800 pt-2 text-[11px] font-mono">
                    <div>
                      <span className="text-mist-500 block">Imports ({outgoing.length})</span>
                      <span className="text-mist-200 font-semibold">{outgoing.length} modules</span>
                    </div>
                    <div>
                      <span className="text-mist-500 block">Imported By ({incoming.length})</span>
                      <span className="text-mist-200 font-semibold">{incoming.length} modules</span>
                    </div>
                  </div>

                  <div className="border-t border-graphite-800 pt-3">
                    <button
                      onClick={() => navigate(`/dashboard/repositories/${repositoryId}/chat`)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-500 shadow-sm"
                    >
                      <span>💬 Ask Chat about this module</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2D Canvas */}
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              nodeLabel="name"
              nodeAutoColorBy="color"
              onNodeClick={handleNodeClick}
              linkColor={() => 'rgba(60, 70, 101, 0.6)'}
              backgroundColor="#090B10"
              width={dimensions.width}
              height={dimensions.height}
              nodeRelSize={6}
              linkDirectionalParticles={1}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleColor={() => '#F59E0B'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
