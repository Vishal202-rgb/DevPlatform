const express = require('express');
const authRoutes = require('./authRoutes');
const githubRoutes = require('./githubRoutes');
const analysisRoutes = require('./analysisRoutes');
const systemRoutes = require('./systemRoutes');
const sharedRoutes = require('./sharedRoutes');
const chatRoutes = require('./chatRoutes');
const architectureRoutes = require('./architectureRoutes');
const knowledgeRoutes = require('./knowledgeRoutes');
const agentRoutes = require('./agentRoutes');
const impactRoutes = require('./impactRoutes');
const engineeringRoutes = require('./engineeringRoutes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy' });
});

router.use('/auth', authRoutes);
router.use('/github', githubRoutes);
router.use('/analysis', analysisRoutes);
router.use('/system', systemRoutes);
router.use('/shared', sharedRoutes); // public - no auth required
router.use('/chat', chatRoutes);
router.use('/architecture', architectureRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/agents', agentRoutes);
router.use('/security', agentRoutes);
router.use('/impact', impactRoutes);
router.use('/engineering', engineeringRoutes);

module.exports = router;