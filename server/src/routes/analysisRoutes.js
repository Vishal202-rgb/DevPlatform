// const express = require('express');
// const {
//   runAnalysis,
//   getLatestAnalysis,
//   getAnalysisHistory,
//   getAnalysisById,
// } = require('../controllers/analysisController');
// const { protect } = require('../middleware/authMiddleware');

// const router = express.Router();

// router.use(protect); // every analysis endpoint requires authentication

// router.post('/:repositoryId/run', runAnalysis);
// router.get('/:repositoryId/latest', getLatestAnalysis);
// router.get('/:repositoryId/history', getAnalysisHistory);
// router.get('/result/:analysisId', getAnalysisById);

// module.exports = router;

const express = require('express');
const {
  runAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisById,
  listAllAnalyses,
  listAllIssues,
} = require('../controllers/analysisController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Cross-repository routes (must come before /:repositoryId/* patterns below)
router.get('/', listAllAnalyses);
router.get('/issues', listAllIssues);
router.get('/result/:analysisId', getAnalysisById);

// Per-repository routes
router.post('/:repositoryId/run', runAnalysis);
router.get('/:repositoryId/latest', getLatestAnalysis);
router.get('/:repositoryId/history', getAnalysisHistory);

module.exports = router;