const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  indexRepositoryKnowledge,
  getKnowledgeStatus,
  queryKnowledge,
} = require('../controllers/knowledgeController');

const router = express.Router();

router.post('/:repositoryId/index', protect, indexRepositoryKnowledge);
router.get('/:repositoryId/status', protect, getKnowledgeStatus);
router.post('/:repositoryId/query', protect, queryKnowledge);

module.exports = router;
