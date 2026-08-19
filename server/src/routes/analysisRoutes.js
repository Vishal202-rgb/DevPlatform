const express = require('express');
const {
  runAnalysis,
  getLatestAnalysis,
  getAnalysisHistory,
  getAnalysisById,
} = require('../controllers/analysisController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect); // every analysis endpoint requires authentication

router.post('/:repositoryId/run', runAnalysis);
router.get('/:repositoryId/latest', getLatestAnalysis);
router.get('/:repositoryId/history', getAnalysisHistory);
router.get('/result/:analysisId', getAnalysisById);

module.exports = router;
