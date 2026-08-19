import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllAnalyses } from '../services/analysisService';

function scoreColor(score) {
  if (score === null || score === undefined) return 'text-mist-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export default function Analyses() {
  const [analyses, setAnalyses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllAnalyses()
      .then(setAnalyses)
      .catch((err) => setError(err.message || 'Failed to load analyses.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-mist-100">Analyses</h1>
        <p className="mt-1 text-sm text-mist-500">
          Every Gemini analysis run across your connected repositories, newest first.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-sm text-mist-500">Loading…</p>
      ) : analyses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="font-mono text-sm text-amber-400">No analyses yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
            Run an analysis from a repository's card on the Repositories page to see it show up
            here.
          </p>
          <Link
            to="/dashboard/repositories"
            className="mt-5 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
          >
            Go to repositories
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900 shadow-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-graphite-700 bg-graphite-800/60 text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3 font-medium">Repository</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Critical</th>
                <th className="px-4 py-3 font-medium">High</th>
                <th className="px-4 py-3 font-medium">Medium</th>
                <th className="px-4 py-3 font-medium">Low</th>
                <th className="px-4 py-3 font-medium">Run at</th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => (
                <tr key={a._id} className="border-b border-graphite-700 last:border-0">
                  <td className="px-4 py-3">
                    {a.repository ? (
                      <Link
                        to={`/dashboard/repositories/${a.repository._id}/analysis`}
                        className="font-mono text-mist-100 hover:text-amber-400"
                      >
                        {a.repository.fullName}
                      </Link>
                    ) : (
                      <span className="text-mist-500">Repository removed</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        a.status === 'completed'
                          ? 'bg-emerald-400/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold ${scoreColor(a.overallScore)}`}>
                    {a.overallScore ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-red-400">{a.summary?.critical ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-orange-400">{a.summary?.high ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-amber-400">{a.summary?.medium ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-sky-400">{a.summary?.low ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-mist-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}