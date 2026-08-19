import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import IssueList from '../components/IssueList';
import { fetchAllIssues } from '../services/analysisService';

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllIssues()
      .then(setIssues)
      .catch((err) => setError(err.message || 'Failed to load issues.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-mist-100">Issues</h1>
        <p className="mt-1 text-sm text-mist-500">
          Every issue from each repository's most recent analysis, across your whole account.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="font-mono text-sm text-mist-500">Loading…</p>
      ) : issues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-10 text-center">
          <p className="font-mono text-sm text-amber-400">No issues to show</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
            Either nothing has been analyzed yet, or your most recent analyses came back clean.
          </p>
          <Link
            to="/dashboard/repositories"
            className="mt-5 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-graphite-950 transition-colors hover:bg-amber-500"
          >
            Go to repositories
          </Link>
        </div>
      ) : (
        <IssueList issues={issues} />
      )}
    </div>
  );
}