const express = require('express');
const authRoutes = require('./authRoutes');
const githubRoutes = require('./githubRoutes');
const analysisRoutes = require('./analysisRoutes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy' });
});

router.use('/auth', authRoutes);
router.use('/github', githubRoutes);
router.use('/analysis', analysisRoutes);

// Future (Part 4+): router.use('/issues', issueRoutes);

module.exports = router;
