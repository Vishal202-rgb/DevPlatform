const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const agentOrchestrator = require('../services/agentOrchestrator');

/**
 * Execute Multi-Agent AI analysis on a repository.
 * POST /api/agents/:repositoryId/run
 */
const runAgents = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const { agents } = req.body;

  const agentRun = await agentOrchestrator.runAgents(repositoryId, req.user.id, {
    agents: Array.isArray(agents) && agents.length ? agents : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Agent run completed successfully',
    data: agentRun,
  });
});

/**
 * Get recent agent runs for a repository.
 * GET /api/agents/:repositoryId/runs
 */
const getAgentRuns = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const runs = await agentOrchestrator.getAgentRuns(repositoryId, limit);

  res.status(200).json({
    success: true,
    data: runs,
  });
});

/**
 * Get details of a single agent run.
 * GET /api/agents/:repositoryId/runs/:runId
 */
const getAgentRunById = asyncHandler(async (req, res) => {
  const { runId } = req.params;

  const run = await agentOrchestrator.getAgentRunById(runId);
  if (!run) {
    throw new ApiError(404, 'Agent run not found');
  }

  res.status(200).json({
    success: true,
    data: run,
  });
});

/**
 * Run Security Agent specifically.
 * POST /api/security/:repositoryId/analyze
 */
const runSecurityAudit = asyncHandler(async (req, res) => {
  const { repositoryId } = req.params;

  const agentRun = await agentOrchestrator.runAgents(repositoryId, req.user.id, {
    agents: ['security'],
  });

  const securityFindings = agentRun.findings.filter((f) => f.agent === 'security');

  const filesScanned = agentRun.summary?.filesScanned || 0;
  const rulesEvaluated = agentRun.summary?.rulesEvaluated || 0;
  const securityScore = agentRun.summary?.securityScore !== undefined ? agentRun.summary.securityScore : 100;

  res.status(200).json({
    success: true,
    message: 'Security audit completed',
    data: {
      runId: agentRun._id,
      findings: securityFindings,
      summary: {
        total: securityFindings.length,
        critical: securityFindings.filter((f) => f.severity === 'critical').length,
        high: securityFindings.filter((f) => f.severity === 'high').length,
        medium: securityFindings.filter((f) => f.severity === 'medium').length,
        low: securityFindings.filter((f) => f.severity === 'low').length,
        filesScanned,
        rulesEvaluated,
        securityScore,
      },
      filesScanned,
      rulesEvaluated,
      securityScore,
      durationMs: agentRun.durationMs,
    },
  });
});

module.exports = {
  runAgents,
  getAgentRuns,
  getAgentRunById,
  runSecurityAudit,
};
