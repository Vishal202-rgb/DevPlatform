import api from './api';

/**
 * Runs backend deployment diagnostics. Passes the browser's own origin so
 * the server can compare it against CLIENT_URL and catch mismatches - this
 * only works meaningfully when actually deployed (comparing localhost to
 * localhost is trivially fine).
 */
export const fetchHealthCheck = async () => {
  const { data } = await api.get('/system/health-check', {
    params: { frontendOrigin: window.location.origin },
  });
  return data.data; // { overallStatus, checks, meta }
};