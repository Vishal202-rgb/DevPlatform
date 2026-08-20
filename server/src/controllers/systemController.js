const asyncHandler = require('express-async-handler');
const systemService = require('../services/systemService');

// @desc    Run deployment diagnostics - catches config mismatches (not full
//          startup failures, since this page can't render if the app never started)
// @route   GET /api/system/health-check
// @access  Private
const getHealthCheck = asyncHandler(async (req, res) => {
  const result = systemService.runHealthChecks(req);
  res.status(200).json({ success: true, data: result });
});

module.exports = { getHealthCheck };