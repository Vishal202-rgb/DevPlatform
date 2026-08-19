const ApiError = require('../utils/ApiError');
const Repository = require('../models/Repository');
const Analysis = require('../models/Analysis');
const githubService = require('./githubService');
const geminiService = require('./geminiService');

const SEVERITY_WEIGHTS = { critical: 15, high: 8, medium: 4, low: 1 };

/**
 * Compute a 0-100 overall score from a list of issues. Starts at 100 and
 * deducts points per issue, weighted by severity.
 */
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

/**
 * Load a repository and verify it belongs to the requesting user.
 */
const getOwnedRepository = async (userId, repositoryId) => {
  const repository = await Repository.findOne({ _id: repositoryId, user: userId });
  if (!repository) {
    throw new ApiError(404, 'Repository not found or not connected to your account.');
  }
  return repository;
};

/**
 * Full pipeline: GitHub source files -> Gemini analysis -> MongoDB.
 */
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
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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
  await getOwnedRepository(userId, repositoryId); // ownership check
  const analysis = await Analysis.findOne({ repository: repositoryId, user: userId }).sort({
    createdAt: -1,
  });
  if (!analysis) {
    throw new ApiError(404, 'No analysis has been run for this repository yet.');
  }
  return analysis;
};

const getAnalysisHistory = async (userId, repositoryId, limit = 20) => {
  await getOwnedRepository(userId, repositoryId); // ownership check
  return Analysis.find({ repository: repositoryId, user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-issues'); // history list is lightweight; fetch full issues via /latest or /:analysisId
};

const getAnalysisById = async (userId, analysisId) => {
  const analysis = await Analysis.findOne({ _id: analysisId, user: userId });
  if (!analysis) {
    throw new ApiError(404, 'Analysis not found.');
  }
  return analysis;
};

module.exports = {
  runAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisById,
  computeScore,
  summarize,
};
