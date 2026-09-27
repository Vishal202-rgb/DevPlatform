const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  calculateImpact,
  getAnalyzableFiles,
  getFileImpact,
} = require('../controllers/impactController');

const router = express.Router();

router.post('/:repositoryId', protect, calculateImpact);
router.get('/:repositoryId/files', protect, getAnalyzableFiles);
router.get('/:repositoryId/file', protect, getFileImpact);

module.exports = router;
