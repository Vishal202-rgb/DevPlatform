import api from './api';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Kick off the GitHub OAuth flow. This MUST be a full top-level navigation
 * (not an axios/fetch call) so the browser follows GitHub's redirect chain
 * and the OAuth `state` round trip works. Auth is carried by the httpOnly
 * cookie set at login, since the Bearer token in localStorage can't travel
 * with a plain browser navigation.
 */
export const redirectToGithubConnect = () => {
  window.location.href = `${baseURL}/github/connect`;
};

export const fetchGithubProfile = async () => {
  const { data } = await api.get('/github/profile');
  return data.data; // { connected, profile }
};

export const fetchGithubRepositories = async () => {
  const { data } = await api.get('/github/repositories');
  return data.data; // array of repositories
};

export const connectRepository = async (githubId) => {
  const { data } = await api.post(`/github/repositories/${githubId}/connect`);
  return data.data.repository;
};

export const disconnectGithub = async () => {
  const { data } = await api.delete('/github/disconnect');
  return data;
};
