const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const analysisService = require('../services/analysisService');

const runAnalysis = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  if (!repositoryId) {
    throw new ApiError(400, 'A repository id is required');
  }

  const analysis = await analysisService.runAnalysis(req.user.id, repositoryId);

  res.status(201).json({
    success: true,
    message: 'Analysis completed',
    data: { analysis },
  });
});

const getLatestAnalysis = asyncHandler(async (req, res) => {
  const analysis = await analysisService.getLatestAnalysis(req.user.id, req.params.repositoryId);
  res.status(200).json({ success: true, data: { analysis } });
});

const getAnalysisHistory = asyncHandler(async (req, res) => {
  const history = await analysisService.getAnalysisHistory(req.user.id, req.params.repositoryId);
  res.status(200).json({ success: true, count: history.length, data: { history } });
});

const getAnalysisById = asyncHandler(async (req, res) => {
  const analysis = await analysisService.getAnalysisById(req.user.id, req.params.analysisId);
  res.status(200).json({ success: true, data: { analysis } });
});

const listAllAnalyses = asyncHandler(async (req, res) => {
  const analyses = await analysisService.getAllAnalysesForUser(req.user.id);
  res.status(200).json({ success: true, count: analyses.length, data: { analyses } });
});

const listAllIssues = asyncHandler(async (req, res) => {
  const { severity } = req.query;
  const issues = await analysisService.getAllIssuesForUser(req.user.id, severity);
  res.status(200).json({ success: true, count: issues.length, data: { issues } });
});

const applyIssueFix = asyncHandler(async (req, res) => {
  const { analysisId, issueId } = req.params;
  const result = await analysisService.applyIssueFix(req.user.id, analysisId, issueId);

  res.status(200).json({
    success: true,
    message: `Fix committed to branch "${result.branch}". Review and open a PR on GitHub.`,
    data: result,
  });
});

const generateIssueTests = asyncHandler(async (req, res) => {
  const { analysisId, issueId } = req.params;
  const result = await analysisService.generateIssueTests(req.user.id, analysisId, issueId);

  res.status(200).json({
    success: true,
    message: `Generated tests successfully.`,
    data: result,
  });
});

const applyIssueTests = asyncHandler(async (req, res) => {
  const { analysisId, issueId } = req.params;
  const { testContent } = req.body;
  if (!testContent) {
    throw new ApiError(400, 'Test content is required');
  }

  const result = await analysisService.applyIssueTests(req.user.id, analysisId, issueId, testContent);

  res.status(200).json({
    success: true,
    message: `Tests committed to branch "${result.branch}". Review and open a PR on GitHub.`,
    data: result,
  });
});

// @desc    Enable public read-only sharing for an analysis (idempotent)
// @route   POST /api/analysis/result/:analysisId/share
// @access  Private
const shareAnalysis = asyncHandler(async (req, res) => {
  const shareToken = await analysisService.enableSharing(req.user.id, req.params.analysisId);
  res.status(200).json({
    success: true,
    message: 'Sharing enabled',
    data: { shareToken, shareUrl: `${env.clientUrl}/share/${shareToken}` },
  });
});

// @desc    Disable public sharing for an analysis
// @route   DELETE /api/analysis/result/:analysisId/share
// @access  Private
const unshareAnalysis = asyncHandler(async (req, res) => {
  await analysisService.disableSharing(req.user.id, req.params.analysisId);
  res.status(200).json({ success: true, message: 'Sharing disabled' });
});

// @desc    Public, unauthenticated read-only view of a shared analysis
// @route   GET /api/shared/:shareToken
// @access  Public
const getSharedAnalysis = asyncHandler(async (req, res) => {
  const report = await analysisService.getSharedAnalysis(req.params.shareToken);
  res.status(200).json({ success: true, data: { report } });
});

module.exports = {
  runAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisById,
  listAllAnalyses,
  listAllIssues,
  applyIssueFix,
  generateIssueTests,
  applyIssueTests,
  shareAnalysis,
  unshareAnalysis,
  getSharedAnalysis,
};