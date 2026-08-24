const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const githubService = require('../services/githubService');
const geminiService = require('../services/geminiService');
const Repository = require('../models/Repository');

const chatWithRepository = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { message, history } = req.body;

  if (!message) {
    throw new ApiError(400, 'Message is required');
  }

  const repo = await Repository.findOne({ _id: repositoryId, user: req.user.id });
  if (!repo) {
    throw new ApiError(404, 'Repository not found');
  }

  const userWithGithub = await githubService.getUserWithGithubToken(req.user.id);
  const accessToken = userWithGithub.github.accessToken;

  // We fetch a bounded set of files to provide context
  const { files } = await githubService.fetchSourceFiles(
    accessToken,
    repo.githubOwner,
    repo.name,
    repo.defaultBranch
  );

  const response = await geminiService.chatWithContext(repo.fullName, files, message, history);

  res.status(200).json({
    success: true,
    data: {
      reply: response.reply,
    },
  });
});

module.exports = {
  chatWithRepository,
};
