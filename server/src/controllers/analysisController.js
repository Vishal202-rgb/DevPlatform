const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const analysisService = require('../services/analysisService');

// @desc    Run a fresh Gemini analysis of a connected repository
// @route   POST /api/analysis/:repositoryId/run
// @access  Private
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

// @desc    Get the most recent analysis for a repository
// @route   GET /api/analysis/:repositoryId/latest
// @access  Private
const getLatestAnalysis = asyncHandler(async (req, res) => {
  const analysis = await analysisService.getLatestAnalysis(req.user.id, req.params.repositoryId);
  res.status(200).json({ success: true, data: { analysis } });
});

// @desc    List past analyses for a repository (lightweight, no issue detail)
// @route   GET /api/analysis/:repositoryId/history
// @access  Private
const getAnalysisHistory = asyncHandler(async (req, res) => {
  const history = await analysisService.getAnalysisHistory(req.user.id, req.params.repositoryId);
  res.status(200).json({ success: true, count: history.length, data: { history } });
});

// @desc    Get a single analysis by id (full issue detail)
// @route   GET /api/analysis/result/:analysisId
// @access  Private
const getAnalysisById = asyncHandler(async (req, res) => {
  const analysis = await analysisService.getAnalysisById(req.user.id, req.params.analysisId);
  res.status(200).json({ success: true, data: { analysis } });
});

module.exports = { runAnalysis, getLatestAnalysis, getAnalysisHistory, getAnalysisById };
