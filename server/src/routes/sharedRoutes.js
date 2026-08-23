const express = require('express');
const { getSharedAnalysis } = require('../controllers/analysisController');

const router = express.Router();

// Deliberately public - no `protect` here. Only reachable with a valid,
// unguessable share token, and only ever returns a redacted, read-only view
// (see analysisService.getSharedAnalysis).
router.get('/:shareToken', getSharedAnalysis);

module.exports = router;