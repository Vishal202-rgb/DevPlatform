import api from './api';

export const runAgents = async (repositoryId, agents) => {
  const { data } = await api.post(`/agents/${repositoryId}/run`, { agents });
  return data.data;
};

export const fetchAgentRuns = async (repositoryId, limit = 10) => {
  const { data } = await api.get(`/agents/${repositoryId}/runs`, {
    params: { limit },
  });
  return data.data;
};

export const fetchAgentRunById = async (runId) => {
  const { data } = await api.get(`/agents/runs/${runId}`);
  return data.data;
};

export const runSecurityAudit = async (repositoryId) => {
  const { data } = await api.post(`/security/${repositoryId}/analyze`);
  return data.data;
};
