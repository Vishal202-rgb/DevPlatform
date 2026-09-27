const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const impactService = require('../services/impactService');

/**
 * Calculate impact analysis for a file or symbol in a repository.
 * POST /api/impact/:repositoryId
 */
const calculateImpact = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { targetPath, targetSymbol } = req.body;

  if (!targetPath) {
    throw new ApiError(400, 'Target file path is required');
  }

  const result = await impactService.analyzeImpact(
    repositoryId,
    targetPath,
    targetSymbol,
    req.user.id
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get all files available for impact analysis.
 * GET /api/impact/:repositoryId/files
 */
const getAnalyzableFiles = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  const files = await impactService.getAnalyzableFiles(repositoryId, req.user.id);

  res.status(200).json({
    success: true,
    data: files,
  });
});

/**
 * Calculate impact via GET query params or path param.
 * GET /api/impact/:repositoryId/file
 */
const getFileImpact = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const filePath = req.query.path || req.params.filePath;
  const symbol = req.query.symbol;

  if (!filePath) {
    throw new ApiError(400, 'File path query parameter "path" is required');
  }

  const result = await impactService.analyzeImpact(
    repositoryId,
    filePath,
    symbol,
    req.user.id
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  calculateImpact,
  getAnalyzableFiles,
  getFileImpact,
};
