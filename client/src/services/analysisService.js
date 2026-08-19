import api from './api';

export const runAnalysis = async (repositoryId) => {
  const { data } = await api.post(`/analysis/${repositoryId}/run`);
  return data.data.analysis;
};

export const fetchLatestAnalysis = async (repositoryId) => {
  const { data } = await api.get(`/analysis/${repositoryId}/latest`);
  return data.data.analysis;
};

export const fetchAnalysisHistory = async (repositoryId) => {
  const { data } = await api.get(`/analysis/${repositoryId}/history`);
  return data.data.history;
};

export const fetchAnalysisById = async (analysisId) => {
  const { data } = await api.get(`/analysis/result/${analysisId}`);
  return data.data.analysis;
};
