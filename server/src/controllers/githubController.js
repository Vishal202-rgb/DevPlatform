const asyncHandler = require('express-async-handler');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository');
const User = require('../models/User');
const githubService = require('../services/githubService');

// @desc    Kick off the GitHub OAuth flow for the authenticated user
// @route   GET /api/github/connect
// @access  Private
const connect = asyncHandler(async (req, res) => {
  const state = githubService.createOAuthState(req.user.id);
  const authorizationUrl = githubService.buildAuthorizationUrl(state);
  res.redirect(authorizationUrl);
});

// @desc    Handle GitHub's OAuth redirect: exchange code, save connection
// @route   GET /api/github/callback
// @access  Public (identity comes from the signed `state`, not a session)
const callback = asyncHandler(async (req, res) => {
  const { code, state, error: githubError } = req.query;

  // The user can decline authorization on GitHub's consent screen
  if (githubError) {
    return res.redirect(`${env.clientUrl}/dashboard?github_error=access_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${env.clientUrl}/dashboard?github_error=missing_params`);
  }

  let userId;
  try {
    userId = githubService.verifyOAuthState(state);
    const { accessToken, scope } = await githubService.exchangeCodeForToken(code);
    const githubUser = await githubService.fetchGithubUser(accessToken);
    await githubService.saveGithubConnection(userId, { githubUser, accessToken, scope });
  } catch (err) {
    const reason = err instanceof ApiError ? err.statusCode : 'server_error';
    // eslint-disable-next-line no-console
    console.error('[github] OAuth callback failed:', err.message);
    return res.redirect(`${env.clientUrl}/dashboard?github_error=${reason}`);
  }

  res.redirect(`${env.clientUrl}/dashboard?github=connected`);
});

// @desc    Get the current user's GitHub connection status/profile
// @route   GET /api/github/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const { github } = req.user;
  const connected = Boolean(github && github.id);

  res.status(200).json({
    success: true,
    data: {
      connected,
      profile: connected
        ? {
            id: github.id,
            username: github.username,
            avatarUrl: github.avatarUrl,
            profileUrl: github.profileUrl,
            connectedAt: github.connectedAt,
          }
        : null,
    },
  });
});

// @desc    List the authenticated user's GitHub repositories (live from GitHub)
// @route   GET /api/github/repositories
// @access  Private
const listRepositories = asyncHandler(async (req, res) => {
  const user = await githubService.getUserWithGithubToken(req.user.id);
  const repos = await githubService.fetchAllUserRepositories(user.github.accessToken);

  // Cross-reference which of these the user has already connected for analysis.
  // (Part 3 addition: also expose the Mongo repositoryId + last-analyzed info,
  // purely additive fields — nothing existing here changes.)
  const savedRepos = await Repository.find({ user: req.user.id })
    .select('githubId lastAnalysis lastAnalyzedAt')
    .lean();
  const savedByGithubId = new Map(savedRepos.map((r) => [r.githubId, r]));

  const data = repos.map((repo) => {
    const saved = savedByGithubId.get(repo.id);
    return {
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      htmlUrl: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      defaultBranch: repo.default_branch,
      private: repo.private,
      githubOwner: repo.owner?.login,
      updatedAt: repo.updated_at,
      connected: Boolean(saved),
      repositoryId: saved ? saved._id : null,
      lastAnalyzedAt: saved ? saved.lastAnalyzedAt : null,
      hasAnalysis: Boolean(saved?.lastAnalysis),
    };
  });

  res.status(200).json({ success: true, count: data.length, data });
});

// @desc    Connect a specific repository for future analysis
// @route   POST /api/github/repositories/:githubId/connect
// @access  Private
const connectRepository = asyncHandler(async (req, res) => {
  const githubId = Number(req.params.githubId);
  if (!githubId) {
    throw new ApiError(400, 'A valid GitHub repository id is required');
  }

  const user = await githubService.getUserWithGithubToken(req.user.id);
  const repo = await githubService.fetchRepositoryById(user.github.accessToken, githubId);
  const repoDoc = githubService.toRepositoryDoc(req.user.id, repo);

  const saved = await Repository.findOneAndUpdate(
    { user: req.user.id, githubId },
    { $set: repoDoc },
    { new: true, upsert: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: `${saved.fullName} connected for analysis`,
    data: { repository: saved },
  });
});

// @desc    Disconnect the user's GitHub account
// @route   DELETE /api/github/disconnect
// @access  Private
const disconnect = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $unset: { github: 1 } });

  res.status(200).json({ success: true, message: 'GitHub account disconnected' });
});

module.exports = { connect, callback, getProfile, listRepositories, connectRepository, disconnect };
