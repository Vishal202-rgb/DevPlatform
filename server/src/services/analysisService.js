const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const Repository = require('../models/Repository');
const Analysis = require('../models/Analysis');
const githubService = require('./githubService');
const geminiService = require('./geminiService');

const SEVERITY_WEIGHTS = { critical: 15, high: 8, medium: 4, low: 1 };

const computeScore = (issues) => {
  const deduction = issues.reduce((sum, issue) => sum + (SEVERITY_WEIGHTS[issue.severity] || 0), 0);
  return Math.max(0, Math.min(100, Math.round(100 - deduction)));
};

const summarize = (issues) => {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, totalIssues: issues.length };
  for (const issue of issues) {
    if (summary[issue.severity] !== undefined) summary[issue.severity] += 1;
  }
  return summary;
};

const getOwnedRepository = async (userId, repositoryId) => {
  const repository = await Repository.findOne({ _id: repositoryId, user: userId });
  if (!repository) {
    throw new ApiError(404, 'Repository not found or not connected to your account.');
  }
  return repository;
};

const runAnalysis = async (userId, repositoryId) => {
  const repository = await getOwnedRepository(userId, repositoryId);
  const user = await githubService.getUserWithGithubToken(userId);

  let files;
  let totalFilesInTree;
  try {
    const result = await githubService.fetchSourceFiles(
      user.github.accessToken,
      repository.githubOwner,
      repository.name,
      repository.defaultBranch
    );
    files = result.files;
    totalFilesInTree = result.totalFilesInTree;
  } catch (error) {
    const analysis = await Analysis.create({
      user: userId,
      repository: repository._id,
      status: 'failed',
      filesAnalyzed: 0,
      error: error.message || 'Failed to fetch repository files from GitHub.',
    });
    throw error instanceof ApiError ? error : new ApiError(502, analysis.error);
  }

  if (!files.length) {
    const analysis = await Analysis.create({
      user: userId,
      repository: repository._id,
      status: 'failed',
      filesAnalyzed: 0,
      error: `No analyzable source files were found (${totalFilesInTree} files scanned in the repository tree, all excluded by ignore rules or size limits).`,
    });
    throw new ApiError(422, analysis.error);
  }

  let issues;
  try {
    issues = await geminiService.analyzeCode(repository.fullName, files);
  } catch (error) {
    await Analysis.create({
      user: userId,
      repository: repository._id,
      status: 'failed',
      filesAnalyzed: files.length,
      error: error.message || 'Gemini analysis failed.',
    });
    throw error;
  }

  const summary = summarize(issues);
  const overallScore = computeScore(issues);

  const analysis = await Analysis.create({
    user: userId,
    repository: repository._id,
    status: 'completed',
    model: env.geminiModel,
    filesAnalyzed: files.length,
    overallScore,
    summary,
    issues,
  });

  repository.lastAnalysis = analysis._id;
  repository.lastAnalyzedAt = analysis.createdAt;
  await repository.save();

  return analysis;
};

const getLatestAnalysis = async (userId, repositoryId) => {
  await getOwnedRepository(userId, repositoryId);
  const analysis = await Analysis.findOne({ repository: repositoryId, user: userId }).sort({
    createdAt: -1,
  });
  if (!analysis) {
    throw new ApiError(404, 'No analysis has been run for this repository yet.');
  }
  return analysis;
};

const getAnalysisHistory = async (userId, repositoryId, limit = 20) => {
  await getOwnedRepository(userId, repositoryId);
  return Analysis.find({ repository: repositoryId, user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-issues');
};

const getAnalysisById = async (userId, analysisId) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }
  return analysis;
};

const getAllAnalysesForUser = async (userId, limit = 50) => {
  return Analysis.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-issues')
    .populate('repository', 'fullName htmlUrl');
};

const getAllIssuesForUser = async (userId, severity) => {
  const repositories = await Repository.find({
    user: userId,
    lastAnalysis: { $ne: null },
  }).populate('lastAnalysis');

  const flattened = [];
  for (const repo of repositories) {
    const analysis = repo.lastAnalysis;
    if (!analysis || analysis.status !== 'completed') continue;

    for (const issue of analysis.issues) {
      if (severity && issue.severity !== severity) continue;
      flattened.push({
        ...(issue.toObject ? issue.toObject() : issue),
        repository: {
          id: repo._id,
          fullName: repo.fullName,
          htmlUrl: repo.htmlUrl,
        },
        analysisId: analysis._id,
        analyzedAt: analysis.createdAt,
      });
    }
  }

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  flattened.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return flattened;
};

const applyIssueFix = async (userId, analysisId, issueId) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }

  const issue = analysis.issues.id(issueId);
  if (!issue) {
    throw new ApiError(404, 'Issue not found on this analysis.');
  }

  const repository = await getOwnedRepository(userId, analysis.repository);
  const user = await githubService.getUserWithGithubToken(userId);
  const { accessToken } = user.github;
  const { githubOwner, name, defaultBranch, htmlUrl } = repository;

  try {
    const { content: originalContent, sha: fileSha } = await githubService.fetchFileContent(
      accessToken,
      githubOwner,
      name,
      issue.file,
      defaultBranch
    );

    const fixedContent = await geminiService.generateFixedFile(issue.file, originalContent, issue);

    if (!fixedContent || fixedContent.trim() === originalContent.trim()) {
      throw new ApiError(422, 'Gemini did not produce a meaningful change for this file.');
    }

    const branchName = `devplatform-fix/${issueId.toString().slice(-8)}-${Date.now().toString(36)}`;
    const headSha = await githubService.getBranchHeadSha(accessToken, githubOwner, name, defaultBranch);
    await githubService.createBranch(accessToken, githubOwner, name, branchName, headSha);
    await githubService.commitFileUpdate(
      accessToken,
      githubOwner,
      name,
      issue.file,
      fixedContent,
      `Fix: ${issue.description.slice(0, 60)}`,
      branchName,
      fileSha
    );

    const compareUrl = `${htmlUrl}/compare/${defaultBranch}...${branchName}?expand=1`;

    issue.fixStatus = 'applied';
    issue.fixBranch = branchName;
    issue.fixCompareUrl = compareUrl;
    issue.fixAppliedAt = new Date();
    issue.fixError = null;
    await analysis.save();

    return { issue, branch: branchName, compareUrl };
  } catch (error) {
    issue.fixStatus = 'failed';
    issue.fixError = error.message || 'Failed to apply fix.';
    await analysis.save();
    throw error instanceof ApiError ? error : new ApiError(502, issue.fixError);
  }
};

const generateIssueTests = async (userId, analysisId, issueId) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }

  const issue = analysis.issues.id(issueId);
  if (!issue) {
    throw new ApiError(404, 'Issue not found on this analysis.');
  }

  const repository = await getOwnedRepository(userId, analysis.repository);
  const user = await githubService.getUserWithGithubToken(userId);
  const { accessToken } = user.github;
  const { githubOwner, name, defaultBranch } = repository;

  try {
    const { content: originalContent } = await githubService.fetchFileContent(
      accessToken,
      githubOwner,
      name,
      issue.file,
      defaultBranch
    );

    const testContent = await geminiService.generateTests(issue.file, originalContent, issue);

    if (!testContent) {
      throw new ApiError(422, 'Gemini did not produce test content for this file.');
    }

    return { testContent };
  } catch (error) {
    throw error instanceof ApiError ? error : new ApiError(502, error.message || 'Failed to generate tests.');
  }
};

const applyIssueTests = async (userId, analysisId, issueId, testContent) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }

  const issue = analysis.issues.id(issueId);
  if (!issue) {
    throw new ApiError(404, 'Issue not found on this analysis.');
  }

  const repository = await getOwnedRepository(userId, analysis.repository);
  const user = await githubService.getUserWithGithubToken(userId);
  const { accessToken } = user.github;
  const { githubOwner, name, defaultBranch, htmlUrl } = repository;

  try {
    const branchName = `devplatform-tests/${issueId.toString().slice(-8)}-${Date.now().toString(36)}`;
    const headSha = await githubService.getBranchHeadSha(accessToken, githubOwner, name, defaultBranch);
    await githubService.createBranch(accessToken, githubOwner, name, branchName, headSha);

    // Determine the test file path by inserting .test before the extension
    const parts = issue.file.split('.');
    const ext = parts.pop();
    const testFilePath = `${parts.join('.')}.test.${ext}`;

    await githubService.commitFileUpdate(
      accessToken,
      githubOwner,
      name,
      testFilePath,
      testContent,
      `Add tests for: ${issue.file}`,
      branchName,
      null // new file
    );

    const compareUrl = `${htmlUrl}/compare/${defaultBranch}...${branchName}?expand=1`;

    return { issue, branch: branchName, compareUrl };
  } catch (error) {
    throw error instanceof ApiError ? error : new ApiError(502, error.message || 'Failed to apply tests.');
  }
};

/**
 * Enable public read-only sharing for an analysis. Idempotent - calling
 * this again on an already-shared analysis returns the SAME token/link
 * rather than rotating it, so a previously distributed link keeps working.
 */
const enableSharing = async (userId, analysisId) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }

  if (!analysis.shareToken) {
    analysis.shareToken = crypto.randomBytes(20).toString('hex');
    await analysis.save();
  }

  return analysis.shareToken;
};

/**
 * Revoke public sharing for an analysis. The link immediately stops
 * working (GET /api/shared/:token will 404).
 */
const disableSharing = async (userId, analysisId) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }
  analysis.shareToken = undefined; // completely removes the field, not just sets it to null
  await analysis.save();
};

/**
 * Public, unauthenticated lookup by share token. Returns a deliberately
 * reduced view - no user id, no Mongo _ids for repository/user, no share
 * token echoed back - just what a read-only report viewer needs to see.
 */
const getSharedAnalysis = async (shareToken) => {
  const analysis = await Analysis.findOne({ shareToken }).populate('repository', 'fullName');
  if (!analysis) {
    throw new ApiError(404, 'This share link is invalid or has been revoked.');
  }

  return {
    repositoryName: analysis.repository ? analysis.repository.fullName : 'Unknown repository',
    status: analysis.status,
    model: analysis.model,
    filesAnalyzed: analysis.filesAnalyzed,
    overallScore: analysis.overallScore,
    summary: analysis.summary,
    issues: analysis.issues.map((issue) => ({
      severity: issue.severity,
      category: issue.category,
      file: issue.file,
      line: issue.line,
      description: issue.description,
      recommendation: issue.recommendation,
      suggestedFix: issue.suggestedFix,
    })),
    createdAt: analysis.createdAt,
  };
};

module.exports = {
  runAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisById,
  getAllAnalysesForUser,
  getAllIssuesForUser,
  applyIssueFix,
  generateIssueTests,
  applyIssueTests,
  enableSharing,
  disableSharing,
  getSharedAnalysis,
  computeScore,
  summarize,
};