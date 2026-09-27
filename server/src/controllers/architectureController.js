const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const githubService = require('../services/githubService');
const architectureService = require('../services/architectureService');
const Repository = require('../models/Repository');
const ArchitectureGraph = require('../models/ArchitectureGraph');

// @desc    Generate or regenerate architecture graph for a specific repository
// @route   POST /api/architecture/:repositoryId/analyze
// @access  Private
const analyzeArchitecture = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const repo = await Repository.findOne({ _id: repositoryId, user: req.user.id });

  if (!repo) {
    throw new ApiError(404, 'Repository not found');
  }

  const userWithGithub = await githubService.getUserWithGithubToken(req.user.id);
  const accessToken = userWithGithub.github.accessToken;

  let files = [];
  try {
    const result = await githubService.fetchSourceFiles(
      accessToken,
      repo.githubOwner,
      repo.name,
      repo.defaultBranch
    );
    files = result.files || [];
  } catch (err) {
    throw err instanceof ApiError ? err : new ApiError(502, err.message || 'Failed to fetch repository files.');
  }

  if (!files.length) {
    throw new ApiError(422, 'No analyzable source files were found in this repository.');
  }

  const result = await architectureService.generateAndSaveArchitecture(repo, files, req.user);

  res.status(200).json({
    success: true,
    message: 'Architecture graph mapped successfully.',
    data: {
      graph: result.graph,
      summary: result.summary,
      repository: result.repository,
    },
  });
});

// @desc    Get architecture graph for a specific repository
// @route   GET /api/architecture/:repositoryId
// @access  Private
const getArchitectureGraph = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  // Verify ownership
  const repo = await Repository.findOne({ _id: repositoryId, user: req.user.id });
  if (!repo) {
    throw new ApiError(404, 'Repository not found');
  }

  const graph = await ArchitectureGraph.findOne({ repository: repo._id });

  res.status(200).json({
    success: true,
    data: {
      graph: graph || null,
      summary: graph?.summary || null,
      repository: {
        id: repo._id,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
        htmlUrl: repo.htmlUrl,
        lastAnalyzedAt: repo.lastAnalyzedAt,
      },
    },
  });
});

module.exports = {
  analyzeArchitecture,
  getArchitectureGraph,
};
