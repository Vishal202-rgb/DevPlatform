import api from './api';

export const indexRepositoryKnowledge = async (repositoryId) => {
  const { data } = await api.post(`/knowledge/${repositoryId}/index`);
  return data.data;
};

export const fetchKnowledgeStatus = async (repositoryId) => {
  const { data } = await api.get(`/knowledge/${repositoryId}/status`);
  return data.data;
};

export const queryKnowledge = async (repositoryId, query, filters = {}) => {
  const { data } = await api.post(`/knowledge/${repositoryId}/query`, { query, filters });
  return data.data;
};
