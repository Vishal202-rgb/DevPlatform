const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  runAgents,
  getAgentRuns,
  getAgentRunById,
  runSecurityAudit,
} = require('../controllers/agentController');

const router = express.Router();

router.post('/:repositoryId/run', protect, runAgents);
router.get('/:repositoryId/runs', protect, getAgentRuns);
router.get('/:repositoryId/runs/:runId', protect, getAgentRunById);
router.get('/runs/:runId', protect, getAgentRunById);
router.post('/:repositoryId/analyze', protect, runSecurityAudit);
router.post('/:repositoryId/security-audit', protect, runSecurityAudit);
router.post('/security/:repositoryId/analyze', protect, runSecurityAudit);

module.exports = router;
