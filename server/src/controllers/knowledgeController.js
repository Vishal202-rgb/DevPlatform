const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const knowledgeService = require('../services/knowledgeService');
const retrievalService = require('../services/retrievalService');

/**
 * Trigger knowledge base indexing for a repository.
 * POST /api/knowledge/:repositoryId/index
 */
const indexRepositoryKnowledge = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  const result = await knowledgeService.indexRepository(repositoryId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Repository knowledge base indexed successfully',
    data: result,
  });
});

/**
 * Get knowledge base indexing status for a repository.
 * GET /api/knowledge/:repositoryId/status
 */
const getKnowledgeStatus = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  const status = await knowledgeService.getStatus(repositoryId, req.user.id);

  res.status(200).json({
    success: true,
    data: status,
  });
});

/**
 * Query the knowledge base directly for testing or semantic search.
 * POST /api/knowledge/:repositoryId/query
 */
const queryKnowledge = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { query, filters, topK } = req.body;

  if (!query) {
    throw new ApiError(400, 'Query text is required');
  }

  const result = await retrievalService.retrieveContext({
    repositoryId,
    query,
    filters,
    topK: topK || 6,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  indexRepositoryKnowledge,
  getKnowledgeStatus,
  queryKnowledge,
};
