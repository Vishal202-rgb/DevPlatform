import { useCallback, useEffect, useState } from 'react';
import {
  fetchGithubProfile,
  redirectToGithubConnect,
  disconnectGithub,
} from '../services/githubService';

export function useGithubConnection() {
  const [profile, setProfile] = useState(null); // { connected, profile }
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchGithubProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Failed to load GitHub connection status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(() => {
    redirectToGithubConnect(); // full page navigation, no promise to await
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectGithub();
    await refresh();
  }, [refresh]);

  return {
    isConnected: Boolean(profile?.connected),
    githubProfile: profile?.profile || null,
    isLoading,
    error,
    connect,
    disconnect,
    refresh,
  };
}
