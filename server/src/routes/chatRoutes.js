const express = require('express');
const { chatWithRepository } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.post('/:repositoryId', chatWithRepository);

module.exports = router;
