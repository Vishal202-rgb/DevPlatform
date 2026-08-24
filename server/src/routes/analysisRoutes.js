const express = require('express');
const {
  runAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisById,
  listAllAnalyses,
  listAllIssues,
  applyIssueFix,
  generateIssueTests,
  applyIssueTests,
  shareAnalysis,
  unshareAnalysis,
} = require('../controllers/analysisController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // every route in this file requires authentication

// Cross-repository routes (must come before /:repositoryId/* patterns below)
router.get('/', listAllAnalyses);
router.get('/issues', listAllIssues);
router.get('/result/:analysisId', getAnalysisById);
router.post('/result/:analysisId/issues/:issueId/apply-fix', applyIssueFix);
router.post('/result/:analysisId/issues/:issueId/generate-tests', generateIssueTests);
router.post('/result/:analysisId/issues/:issueId/apply-tests', applyIssueTests);
router.post('/result/:analysisId/share', shareAnalysis);
router.delete('/result/:analysisId/share', unshareAnalysis);

// Per-repository routes
router.post('/:repositoryId/run', runAnalysis);
router.get('/:repositoryId/latest', getLatestAnalysis);
router.get('/:repositoryId/history', getAnalysisHistory);

module.exports = router;