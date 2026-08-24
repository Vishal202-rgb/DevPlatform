const express = require('express');
const {
  analyzeArchitecture,
  getArchitectureGraph,
} = require('../controllers/architectureController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/:repositoryId/analyze', analyzeArchitecture);
router.get('/:repositoryId', getArchitectureGraph);

module.exports = router;
