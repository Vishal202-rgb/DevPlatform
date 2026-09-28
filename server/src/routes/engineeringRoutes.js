const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  generateFixProposal,
  validateFix,
  applyApprovedFix,
  generateTests,
  applyTests,
  runTests,
  verifyFix,
  remediateIssue,
  diagnoseFailure,
  getAuditTrail,
  getPrReadiness,
  revertChanges,
} = require('../controllers/engineeringController');

const router = express.Router();

router.post('/:repositoryId/generate-fix', protect, generateFixProposal);
router.post('/:repositoryId/validate-fix', protect, validateFix);
router.post('/:repositoryId/apply-fix', protect, applyApprovedFix);
router.post('/:repositoryId/generate-tests', protect, generateTests);
router.post('/:repositoryId/apply-tests', protect, applyTests);
router.post('/:repositoryId/run-tests', protect, runTests);
router.post('/:repositoryId/verify-fix', protect, verifyFix);
router.post('/:repositoryId/remediate', protect, remediateIssue);
router.post('/:repositoryId/diagnose-failure', protect, diagnoseFailure);
router.get('/:repositoryId/audit-trail', protect, getAuditTrail);
router.post('/:repositoryId/pr-readiness', protect, getPrReadiness);
router.post('/:repositoryId/revert', protect, revertChanges);

module.exports = router;
