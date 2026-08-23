// // import api from './api';

// // export const runAnalysis = async (repositoryId) => {
// //   const { data } = await api.post(`/analysis/${repositoryId}/run`);
// //   return data.data.analysis;
// // };

// // export const fetchLatestAnalysis = async (repositoryId) => {
// //   const { data } = await api.get(`/analysis/${repositoryId}/latest`);
// //   return data.data.analysis;
// // };

// // export const fetchAnalysisHistory = async (repositoryId) => {
// //   const { data } = await api.get(`/analysis/${repositoryId}/history`);
// //   return data.data.history;
// // };

// // export const fetchAnalysisById = async (analysisId) => {
// //   const { data } = await api.get(`/analysis/result/${analysisId}`);
// //   return data.data.analysis;
// // };

// import api from './api';

// export const runAnalysis = async (repositoryId) => {
//   const { data } = await api.post(`/analysis/${repositoryId}/run`);
//   return data.data.analysis;
// };

// export const fetchLatestAnalysis = async (repositoryId) => {
//   const { data } = await api.get(`/analysis/${repositoryId}/latest`);
//   return data.data.analysis;
// };

// export const fetchAnalysisHistory = async (repositoryId) => {
//   const { data } = await api.get(`/analysis/${repositoryId}/history`);
//   return data.data.history;
// };

// export const fetchAnalysisById = async (analysisId) => {
//   const { data } = await api.get(`/analysis/result/${analysisId}`);
//   return data.data.analysis;
// };

// export const fetchAllAnalyses = async () => {
//   const { data } = await api.get('/analysis');
//   return data.data.analyses;
// };

// export const fetchAllIssues = async (severity) => {
//   const { data } = await api.get('/analysis/issues', {
//     params: severity && severity !== 'all' ? { severity } : {},
//   });
//   return data.data.issues;
// };
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

export const fetchAllAnalyses = async () => {
  const { data } = await api.get('/analysis');
  return data.data.analyses;
};

export const fetchAllIssues = async (severity) => {
  const { data } = await api.get('/analysis/issues', {
    params: severity && severity !== 'all' ? { severity } : {},
  });
  return data.data.issues;
};

export const applyIssueFix = async (analysisId, issueId) => {
  const { data } = await api.post(`/analysis/result/${analysisId}/issues/${issueId}/apply-fix`);
  return data.data; // { issue, branch, compareUrl }
};

export const shareAnalysis = async (analysisId) => {
  const { data } = await api.post(`/analysis/result/${analysisId}/share`);
  return data.data; // { shareToken, shareUrl }
};

export const unshareAnalysis = async (analysisId) => {
  const { data } = await api.delete(`/analysis/result/${analysisId}/share`);
  return data;
};

export const fetchSharedReport = async (shareToken) => {
  const { data } = await api.get(`/shared/${shareToken}`);
  return data.data.report;
};
