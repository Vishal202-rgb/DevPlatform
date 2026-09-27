import api from './api';

export const generateFixProposal = async (repositoryId, issueData) => {
  const { data } = await api.post(`/engineering/${repositoryId}/generate-fix`, issueData);
  return data.data;
};

export const validateFix = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/validate-fix`, payload);
  return data.data;
};

export const applyApprovedFix = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/apply-fix`, payload);
  return data.data;
};

export const generateComprehensiveTests = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/generate-tests`, payload);
  return data.data;
};

export const applyApprovedTests = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/apply-tests`, payload);
  return data.data;
};

export const executeControlledTests = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/run-tests`, payload);
  return data.data;
};

export const verifyFixResolution = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/verify-fix`, payload);
  return data.data;
};

export const diagnoseTestFailure = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/diagnose-failure`, payload);
  return data.data;
};

export const fetchAuditTrail = async (repositoryId, limit = 20) => {
  const { data } = await api.get(`/engineering/${repositoryId}/audit-trail`, {
    params: { limit },
  });
  return data.data;
};

export const fetchPrReadiness = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/pr-readiness`, payload);
  return data.data;
};

export const revertSessionChanges = async (repositoryId, payload) => {
  const { data } = await api.post(`/engineering/${repositoryId}/revert`, payload);
  return data.data;
};
