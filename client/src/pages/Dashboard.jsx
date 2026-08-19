import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StatCard from '../components/StatCard';
import GithubConnectionCard from '../components/GithubConnectionCard';
import { useGithubConnection } from '../hooks/useGithubConnection';
import { fetchGithubRepositories } from '../services/githubService';

const githubErrorMessages = {
  access_denied: 'GitHub authorization was cancelled.',
  missing_params: 'GitHub redirected back without the expected parameters.',
  400: 'The GitHub authorization request was invalid or expired. Please try again.',
  401: 'GitHub rejected the request. Please try connecting again.',
  server_error: 'Something went wrong connecting to GitHub. Please try again.',
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected } = useGithubConnection();
  const [repoCount, setRepoCount] = useState(null);

  const banner = useMemo(() => {
    if (searchParams.get('github') === 'connected') {
      return { type: 'success', message: 'GitHub connected successfully.' };
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

  // Clear the query params once we've read them, so a refresh doesn't re-show the banner
  useEffect(() => {
    if (banner) {
      const next = new URLSearchParams(searchParams);
      next.delete('github');
      next.delete('github_error');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setRepoCount(null);
      return;
    }
    fetchGithubRepositories()
      .then((repos) => setRepoCount(repos.length))
      .catch(() => setRepoCount(null));
  }, [isConnected]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-mist-100">Overview</h1>
        <p className="mt-1 text-sm text-mist-500">
          Connect GitHub to pull in repositories. Analyses and issue tracking still show
          placeholder values until AI analysis lands.
        </p>
      </div>

      <div className="mb-6">
        <GithubConnectionCard banner={banner} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Repositories"
          value={repoCount ?? (isConnected ? '…' : '0')}
          hint={isConnected ? 'Live from GitHub' : 'Connect GitHub to see repositories'}
        />
        <StatCard label="Analyses" value="0" hint="No analyses run yet" />
        <StatCard label="Issues" value="0" hint="No issues detected yet" accent />
        <StatCard label="Code Health" value="—" hint="Awaiting first analysis" />
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-graphite-700 bg-graphite-900/60 p-8 text-center">
        <p className="font-mono text-sm text-amber-400">
          {isConnected ? 'Analysis engine not built yet' : 'Nothing connected yet'}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist-500">
          {isConnected
            ? 'Head to Repositories to browse and connect repos. AI-driven analysis and issue tracking will populate this dashboard in a later build.'
            : 'Connect GitHub above, then visit Repositories to browse and connect repos for future analysis.'}
        </p>
      </div>
    </div>
  );
}
