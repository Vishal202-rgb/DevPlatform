const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const githubService = require('../services/githubService');
const geminiService = require('../services/geminiService');
const Repository = require('../models/Repository');
const { isAnalyzablePath } = require('../utils/fileFilters');

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

  // Step 1: Fetch full tree (only analyzable blobs)
  const tree = await githubService.fetchRepositoryTree(
    accessToken,
    repo.githubOwner,
    repo.name,
    repo.defaultBranch
  );

  const treePaths = tree
    .filter((entry) => entry.type === 'blob' && isAnalyzablePath(entry.path))
    .map((entry) => entry.path);

  // Step 2: Use Gemini to find relevant files
  let relevantPaths = [];
  if (treePaths.length > 0) {
    relevantPaths = await geminiService.findRelevantFiles(repo.fullName, treePaths, message);
  }

  // Step 3: Fetch blob contents for the selected paths
  const files = [];
  let totalChars = 0;
  const MAX_TOTAL_CHARS = 150_000; // safety limit

  for (const path of relevantPaths) {
    const entry = tree.find(e => e.path === path);
    if (!entry) continue;

    if (totalChars >= MAX_TOTAL_CHARS) break;

    const content = await githubService.fetchBlobContent(accessToken, repo.githubOwner, repo.name, entry.sha);
    if (!content) continue;

    const remaining = MAX_TOTAL_CHARS - totalChars;
    const truncated = content.length > remaining;
    const finalContent = truncated ? content.slice(0, remaining) : content;

    files.push({ path: entry.path, content: finalContent, truncated });
    totalChars += finalContent.length;
  }

  // Step 4: Chat with context
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
