import api from './api';

export const calculateImpact = async (repositoryId, targetPath, targetSymbol) => {
  const { data } = await api.post(`/impact/${repositoryId}`, {
    targetPath,
    targetSymbol,
  });
  return data.data;
};

export const fetchImpactFiles = async (repositoryId) => {
  const { data } = await api.get(`/impact/${repositoryId}/files`);
  return data.data;
};
