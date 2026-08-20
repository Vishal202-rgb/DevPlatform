const axios = require('axios');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { isAnalyzablePath } = require('../utils/fileFilters');

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_BASE = 'https://api.github.com';

// Scopes: read:user for profile, repo for listing both public & private repos.
const GITHUB_SCOPES = 'read:user repo';

// Short-lived "state" token binds the OAuth round trip to the user who
// initiated it and doubles as CSRF protection, since GitHub echoes it back
// verbatim on the callback.
const STATE_TOKEN_EXPIRY = '10m';

const githubApi = axios.create({
  baseURL: GITHUB_API_BASE,
  headers: { Accept: 'application/vnd.github+json' },
  timeout: 10000,
});

/**
 * Translate axios/GitHub errors into ApiError with sensible status codes,
 * including explicit handling of GitHub's rate-limit response shape.
 */
const handleGithubError = (error, fallbackMessage) => {
  if (error.response) {
    const { status, headers, data } = error.response;

    const remaining = headers?.['x-ratelimit-remaining'];
    if (status === 403 && remaining === '0') {
      const resetEpoch = Number(headers['x-ratelimit-reset']) * 1000;
      const resetsAt = resetEpoch ? new Date(resetEpoch).toISOString() : undefined;
      throw new ApiError(429, 'GitHub API rate limit exceeded. Please try again later.', {
        resetsAt,
      });
    }

    if (status === 401) {
      throw new ApiError(401, 'GitHub authorization is invalid or has expired. Please reconnect GitHub.');
    }

    throw new ApiError(status, data?.message || fallbackMessage);
  }

  throw new ApiError(502, fallbackMessage);
};

/**
 * Create a signed, short-lived state token embedding the initiating user's id.
 */
const createOAuthState = (userId) => {
  return jwt.sign({ purpose: 'github_oauth', userId }, env.jwtSecret, {
    expiresIn: STATE_TOKEN_EXPIRY,
  });
};

/**
 * Verify a state token returned by GitHub's callback.
 */
const verifyOAuthState = (state) => {
  try {
    const decoded = jwt.verify(state, env.jwtSecret);
    if (decoded.purpose !== 'github_oauth' || !decoded.userId) {
      throw new Error('invalid state payload');
    }
    return decoded.userId;
  } catch (err) {
    throw new ApiError(400, 'Invalid or expired GitHub authorization request. Please try connecting again.');
  }
};

/**
 * Build the GitHub authorization URL the user's browser should be sent to.
 */
const buildAuthorizationUrl = (state) => {
  if (!env.githubClientId) {
    throw new ApiError(500, 'GitHub integration is not configured on the server.');
  }
  const params = new URLSearchParams({
    client_id: env.githubClientId,
    redirect_uri: env.githubCallbackUrl,
    scope: GITHUB_SCOPES,
    state,
    allow_signup: 'false',
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
};

/**
 * Exchange an OAuth `code` for an access token.
 */
const exchangeCodeForToken = async (code) => {
  try {
    const { data } = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id: env.githubClientId,
        client_secret: env.githubClientSecret,
        code,
        redirect_uri: env.githubCallbackUrl,
      },
      { headers: { Accept: 'application/json' }, timeout: 10000 }
    );

    if (data.error) {
      throw new ApiError(400, data.error_description || 'GitHub rejected the authorization request.');
    }
    if (!data.access_token) {
      throw new ApiError(502, 'GitHub did not return an access token.');
    }

    return { accessToken: data.access_token, scope: data.scope };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleGithubError(error, 'Failed to exchange GitHub authorization code.');
  }
};

/**
 * Fetch the authenticated GitHub user's profile.
 */
const fetchGithubUser = async (accessToken) => {
  try {
    const { data } = await githubApi.get('/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  } catch (error) {
    handleGithubError(error, 'Failed to fetch GitHub profile.');
  }
};

/**
 * Persist (or update) the GitHub connection on a User document.
 */
const saveGithubConnection = async (userId, { githubUser, accessToken, scope }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.github = {
    id: githubUser.id,
    username: githubUser.login,
    avatarUrl: githubUser.avatar_url,
    profileUrl: githubUser.html_url,
    accessToken,
    scope,
    connectedAt: new Date(),
  };
  await user.save();
  return user;
};

/**
 * Load a user WITH their GitHub access token (normally excluded by `select: false`).
 * Only ever used server-side to call the GitHub API on the user's behalf.
 */
const getUserWithGithubToken = async (userId) => {
  const user = await User.findById(userId).select('+github.accessToken');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  if (!user.github || !user.github.accessToken) {
    throw new ApiError(400, 'GitHub is not connected for this account. Connect GitHub first.');
  }
  return user;
};

/**
 * List a single page of the authenticated GitHub user's repositories.
 * GitHub caps per_page at 100, so callers wanting the full list should use
 * fetchAllUserRepositories below instead of calling this directly.
 */
const fetchUserRepositories = async (accessToken, { page = 1, perPage = 30 } = {}) => {
  try {
    const { data } = await githubApi.get('/user/repos', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page,
        // Only repos the user directly owns - matches the count shown on
        // their GitHub profile page. (Not collaborator/org-member repos,
        // which GitHub's own profile "Repositories" count also excludes.)
        affiliation: 'owner',
      },
    });
    return data;
  } catch (error) {
    handleGithubError(error, 'Failed to fetch repositories from GitHub.');
  }
};

/**
 * List EVERY repository the user can see, following GitHub's pagination
 * automatically (100 per page, the API's max) until a short page signals
 * there's nothing left. Capped at MAX_PAGES as a safety limit for accounts
 * with an unusually large number of repositories/org affiliations.
 */
const MAX_REPO_PAGES = 10; // 10 x 100 = up to 1,000 repos
const fetchAllUserRepositories = async (accessToken) => {
  const perPage = 100;
  let allRepos = [];

  for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
    // Route through module.exports so this stays consistent with how every
    // other function in this module is mocked/overridden in tests.
    // eslint-disable-next-line no-await-in-loop
    const pageResults = await module.exports.fetchUserRepositories(accessToken, { page, perPage });
    allRepos = allRepos.concat(pageResults);
    if (pageResults.length < perPage) break; // last page reached
  }

  return allRepos;
};

/**
 * Fetch a single repository by its GitHub numeric id.
 */
const fetchRepositoryById = async (accessToken, githubId) => {
  try {
    const { data } = await githubApi.get(`/repositories/${githubId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  } catch (error) {
    handleGithubError(error, 'Failed to fetch repository from GitHub.');
  }
};

/**
 * Map a raw GitHub API repository object to only the fields we persist.
 */
const toRepositoryDoc = (userId, repo) => ({
  user: userId,
  githubId: repo.id,
  name: repo.name,
  fullName: repo.full_name,
  description: repo.description || '',
  htmlUrl: repo.html_url,
  cloneUrl: repo.clone_url,
  language: repo.language,
  stars: repo.stargazers_count,
  forks: repo.forks_count,
  defaultBranch: repo.default_branch,
  private: repo.private,
  githubOwner: repo.owner?.login,
});

// ---------------------------------------------------------------------------
// Source-file fetching (Part 3 - feeds the Gemini analysis pipeline).
// We never fetch or store an entire repository; we cap how much we pull
// down and only fetch files that pass the ignore/allow filters.
// ---------------------------------------------------------------------------

const MAX_FILES = 40; // hard cap on number of files sent to Gemini
const MAX_FILE_BYTES = 40_000; // skip individual files larger than this
const MAX_TOTAL_CHARS = 150_000; // stop accumulating once combined content is this large

/**
 * Fetch the full recursive file tree for a repository's default branch.
 */
const fetchRepositoryTree = async (accessToken, owner, repo, branch) => {
  try {
    const { data } = await githubApi.get(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { recursive: 1 },
      }
    );
    if (data.truncated) {
      // eslint-disable-next-line no-console
      console.warn(`[github] Tree for ${owner}/${repo}@${branch} was truncated by GitHub's API.`);
    }
    return data.tree || [];
  } catch (error) {
    handleGithubError(error, 'Failed to fetch repository file tree from GitHub.');
  }
};

/**
 * Fetch a single blob's content (base64) and decode it to UTF-8 text.
 */
const fetchBlobContent = async (accessToken, owner, repo, sha) => {
  try {
    const { data } = await githubApi.get(`/repos/${owner}/${repo}/git/blobs/${sha}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (data.encoding !== 'base64') {
      return null; // unexpected encoding, skip rather than mis-decode
    }
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    handleGithubError(error, 'Failed to fetch file content from GitHub.');
  }
};

/**
 * Fetch a bounded, filtered set of source files from a repository, ready to
 * hand to the Gemini analysis service. Applies the ignore/allow rules from
 * fileFilters, then caps by file count and total character volume so a huge
 * repository doesn't blow up the prompt (or the bill).
 */
const fetchSourceFiles = async (accessToken, owner, repo, branch) => {
  const tree = await fetchRepositoryTree(accessToken, owner, repo, branch);

  const candidates = tree
    .filter((entry) => entry.type === 'blob')
    .filter((entry) => isAnalyzablePath(entry.path))
    .filter((entry) => typeof entry.size !== 'number' || entry.size <= MAX_FILE_BYTES)
    .slice(0, MAX_FILES);

  const files = [];
  let totalChars = 0;

  for (const entry of candidates) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    // eslint-disable-next-line no-await-in-loop
    const content = await fetchBlobContent(accessToken, owner, repo, entry.sha);
    if (!content) continue; // binary/undecodable, skip

    const remaining = MAX_TOTAL_CHARS - totalChars;
    const truncated = content.length > remaining;
    const finalContent = truncated ? content.slice(0, remaining) : content;

    files.push({ path: entry.path, content: finalContent, truncated });
    totalChars += finalContent.length;
  }

  return { files, totalFilesInTree: tree.filter((e) => e.type === 'blob').length };
};

// ---------------------------------------------------------------------------
// Fix-application (Part 5) - fetch a single file, branch, and commit a fix.
// These write to a NEW branch only, never the repository's default branch.
// ---------------------------------------------------------------------------

/**
 * Fetch a single file's current content + blob sha (needed to commit an
 * update to it) from a specific branch/ref.
 */
const fetchFileContent = async (accessToken, owner, repo, path, ref) => {
  try {
    const { data } = await githubApi.get(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { ref },
      }
    );
    if (Array.isArray(data) || data.type !== 'file') {
      throw new ApiError(400, `"${path}" is not a single file (it may have been moved or is now a directory).`);
    }
    if (data.encoding !== 'base64') {
      throw new ApiError(502, `Unexpected encoding for "${path}" from GitHub.`);
    }
    return {
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      sha: data.sha,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.response?.status === 404) {
      throw new ApiError(404, `"${path}" no longer exists in this repository.`);
    }
    handleGithubError(error, `Failed to fetch "${path}" from GitHub.`);
  }
};

/**
 * Get the current commit SHA a branch points to.
 */
const getBranchHeadSha = async (accessToken, owner, repo, branch) => {
  try {
    const { data } = await githubApi.get(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data.object.sha;
  } catch (error) {
    handleGithubError(error, `Failed to read the "${branch}" branch from GitHub.`);
  }
};

/**
 * Create a new branch pointing at the given commit SHA.
 */
const createBranch = async (accessToken, owner, repo, newBranch, fromSha) => {
  try {
    await githubApi.post(
      `/repos/${owner}/${repo}/git/refs`,
      { ref: `refs/heads/${newBranch}`, sha: fromSha },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (error) {
    handleGithubError(error, `Failed to create branch "${newBranch}" on GitHub.`);
  }
};

/**
 * Commit an updated file to a branch (the branch must already exist).
 */
const commitFileUpdate = async (accessToken, owner, repo, path, newContent, message, branch, fileSha) => {
  try {
    await githubApi.put(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        message,
        content: Buffer.from(newContent, 'utf-8').toString('base64'),
        sha: fileSha,
        branch,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (error) {
    handleGithubError(error, `Failed to commit the fix to "${path}" on GitHub.`);
  }
};

module.exports = {
  createOAuthState,
  verifyOAuthState,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchGithubUser,
  saveGithubConnection,
  getUserWithGithubToken,
  fetchUserRepositories,
  fetchAllUserRepositories,
  fetchRepositoryById,
  toRepositoryDoc,
  fetchRepositoryTree,
  fetchBlobContent,
  fetchSourceFiles,
  fetchFileContent,
  getBranchHeadSha,
  createBranch,
  commitFileUpdate,
};
