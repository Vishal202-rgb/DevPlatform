const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const githubService = require('../services/githubService');
const geminiService = require('../services/geminiService');
const Repository = require('../models/Repository');
const ArchitectureGraph = require('../models/ArchitectureGraph');

const analyzeArchitecture = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const repo = await Repository.findOne({ _id: repositoryId, user: req.user.id });
  
  if (!repo) {
    throw new ApiError(404, 'Repository not found');
  }

  const userWithGithub = await githubService.getUserWithGithubToken(req.user.id);
  const accessToken = userWithGithub.github.accessToken;

  const { files } = await githubService.fetchSourceFiles(
    accessToken,
    repo.githubOwner,
    repo.name,
    repo.defaultBranch
  );

  if (!files.length) {
    throw new ApiError(422, 'No analyzable source files were found.');
  }

  const graphData = await geminiService.generateArchitectureGraph(repo.fullName, files);

  let graph = await ArchitectureGraph.findOne({ repository: repo._id });
  if (graph) {
    graph.nodes = graphData.nodes;
    graph.links = graphData.links;
    await graph.save();
  } else {
    graph = await ArchitectureGraph.create({
      repository: repo._id,
      nodes: graphData.nodes,
      links: graphData.links,
    });
  }

  res.status(200).json({
    success: true,
    data: { graph },
  });
});

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
    data: { graph },
  });
});

module.exports = {
  analyzeArchitecture,
  getArchitectureGraph,
};
