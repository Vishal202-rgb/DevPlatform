const express = require('express');
const {
  connect,
  callback,
  getProfile,
  listRepositories,
  connectRepository,
  disconnect,
} = require('../controllers/githubController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Initiates the OAuth redirect - authenticated via the httpOnly cookie since
// this is a top-level browser navigation, not an XHR/fetch call.
router.get('/connect', protect, connect);

// GitHub redirects the browser here after the user approves/denies access.
// Identity is recovered from the signed `state` param, not from a session.
router.get('/callback', callback);

router.get('/profile', protect, getProfile);
router.get('/repositories', protect, listRepositories);
router.post('/repositories/:githubId/connect', protect, connectRepository);
router.delete('/disconnect', protect, disconnect);

module.exports = router;
