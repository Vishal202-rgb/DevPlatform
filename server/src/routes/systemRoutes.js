const express = require('express');
const { getHealthCheck } = require('../controllers/systemController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/health-check', protect, getHealthCheck);

module.exports = router;