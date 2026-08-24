import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ForceGraph2D from "react-force-graph-2d";
import api from '../services/api';

export default function Architecture() {
  const { repositoryId } = useParams();
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const fgRef = useRef();

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/architecture/${repositoryId}`);
      if (data.data.graph) {
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
    try {
      const { data } = await api.post(`/architecture/${repositoryId}/analyze`);
      setGraphData(data.data.graph);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to analyze architecture.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNodeClick = useCallback(node => {
    fgRef.current.centerAt(node.x, node.y, 1000);
    fgRef.current.zoom(8, 2000);
  }, [fgRef]);

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Architecture Graph</h1>
          <p className="mt-1 text-sm text-mist-500">
            Interactive visualization of module dependencies and imports.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/dashboard/repositories" className="text-sm text-mist-500 hover:text-amber-400">
            ← Back to repositories
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 relative">
        {isAnalyzing ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-10">
            <span className="mb-3 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
            <p className="font-mono text-sm text-amber-400">Analyzing architecture…</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
              Gemini is mapping out the dependencies in this repository.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-sm text-mist-500">Loading…</p>
          </div>
        ) : !graphData || !graphData.nodes.length ? (
          <div className="flex h-full flex-col items-center justify-center p-10 text-center">
            <p className="font-mono text-sm text-amber-400">No architecture graph yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
              Generate an interactive visualization of module dependencies.
            </p>
            <button
              onClick={handleAnalyze}
              className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
            >
              Generate Graph
            </button>
          </div>
        ) : (
          <div className="h-full w-full">
            <div className="absolute top-4 left-4 z-10">
              <button
                onClick={handleAnalyze}
                className="rounded-lg bg-graphite-800 px-3 py-1.5 text-xs font-semibold text-mist-100 transition-colors hover:bg-graphite-700"
              >
                Regenerate Graph
              </button>
              <button
                onClick={() => {
                  fgRef.current.zoomToFit(400);
                }}
                className="ml-2 rounded-lg bg-graphite-800 px-3 py-1.5 text-xs font-semibold text-mist-100 transition-colors hover:bg-graphite-700"
              >
                Reset Zoom
              </button>
            </div>
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              nodeLabel="name"
              nodeAutoColorBy="color"
              onNodeClick={handleNodeClick}
              linkColor={() => '#4b5563'} // graphite-600
              backgroundColor="#18181b" // graphite-900
              width={window.innerWidth - 300} // rough estimate based on sidebar
              height={window.innerHeight - 150}
            />
          </div>
        )}
      </div>
    </div>
  );
}
