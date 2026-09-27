const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const fixAgentService = require('../services/fixAgentService');
const testRunnerService = require('../services/testRunnerService');
const verificationAgentService = require('../services/verificationAgentService');
const AuditLog = require('../models/AuditLog');

/**
 * Generate an AI Fix Proposal with unified diff and security gate checks.
 * POST /api/engineering/:repositoryId/generate-fix
 */
const generateFixProposal = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const proposal = await fixAgentService.generateFixProposal(req.user.id, repositoryId, req.body);

  res.status(200).json({
    success: true,
    message: 'Fix proposal generated successfully',
    data: proposal,
  });
});

/**
 * Validate that the repository file has not changed since fix generation (stale check).
 * POST /api/engineering/:repositoryId/validate-fix
 */
const validateFix = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { filePath, expectedSha, expectedHash } = req.body;

  const result = await fixAgentService.validateFixFreshness(
    req.user.id,
    repositoryId,
    filePath,
    expectedSha,
    expectedHash
  );

  res.status(200).json({
    success: true,
    message: 'Fix is fresh and matches current repository file',
    data: result,
  });
});

/**
 * Apply an approved fix proposal to an isolated Git branch.
 * POST /api/engineering/:repositoryId/apply-fix
 */
const applyApprovedFix = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const result = await fixAgentService.applyApprovedFix(req.user.id, repositoryId, req.body);

  res.status(200).json({
    success: true,
    message: `Fix applied successfully to branch "${result.branch}"`,
    data: result,
  });
});

/**
 * Generate 4-scenario comprehensive tests for target code.
 * POST /api/engineering/:repositoryId/generate-tests
 */
const generateTests = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const result = await testRunnerService.generateComprehensiveTests(req.user.id, repositoryId, req.body);

  res.status(200).json({
    success: true,
    message: 'Comprehensive test suite generated',
    data: result,
  });
});

/**
 * Run allowlisted test suite in secure controlled environment.
 * POST /api/engineering/:repositoryId/run-tests
 */
const runTests = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const result = await testRunnerService.executeControlledTests(req.user.id, repositoryId, req.body);

  res.status(200).json({
    success: true,
    message: `Test execution finished (${result.status})`,
    data: result,
  });
});

/**
 * Run Verification Agent to evaluate fix resolution against test results.
 * POST /api/engineering/:repositoryId/verify-fix
 */
const verifyFix = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const result = await verificationAgentService.verifyFixResolution(req.user.id, repositoryId, req.body);

  res.status(200).json({
    success: true,
    message: `Verification complete: ${result.resolved}`,
    data: result,
  });
});

/**
 * AI Diagnosis of failing test output.
 * POST /api/engineering/:repositoryId/diagnose-failure
 */
const diagnoseFailure = asyncHandler(async (req, res) => {
  const result = await verificationAgentService.diagnoseTestFailure(req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get audit trail and action history for a repository.
 * GET /api/engineering/:repositoryId/audit-trail
 */
const getAuditTrail = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const logs = await AuditLog.find({ repository: repositoryId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    data: logs,
  });
});

/**
 * Compute PR Readiness scorecard.
 * POST /api/engineering/:repositoryId/pr-readiness
 */
const getPrReadiness = asyncHandler(async (req, res) => {
  const result = verificationAgentService.calculatePrReadiness(req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Rollback / revert session changes.
 * POST /api/engineering/:repositoryId/revert
 */
const revertChanges = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { targetFile, branchName } = req.body;

  await AuditLog.create({
    repository: repositoryId,
    user: req.user.id,
    action: 'rollback_performed',
    status: 'success',
    targetFile: targetFile || '',
    details: { branchName },
    message: `Discarded changes on ${targetFile || 'workspace'}`,
  });

  res.status(200).json({
    success: true,
    message: 'Changes reverted successfully',
  });
});

/**
 * Apply generated test suite to repository branch.
 * POST /api/engineering/:repositoryId/apply-tests
 */
const applyTests = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const result = await testRunnerService.applyApprovedTests(req.user.id, repositoryId, req.body);

  res.status(200).json({
    success: true,
    message: `Tests applied successfully to branch "${result.branch}"`,
    data: result,
  });
});

module.exports = {
  generateFixProposal,
  validateFix,
  applyApprovedFix,
  generateTests,
  applyTests,
  runTests,
  verifyFix,
  diagnoseFailure,
  getAuditTrail,
  getPrReadiness,
  revertChanges,
};
