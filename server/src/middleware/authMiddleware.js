const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

/**
 * Protect routes - verifies JWT from either the Authorization header
 * (Bearer token) or the httpOnly cookie, then attaches req.user.
 */
const protect = asyncHandler(async (req, _res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw new ApiError(401, 'Not authorized, token invalid or expired');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'Not authorized, user no longer exists');
  }

  req.user = user;
  next();
});

/**
 * Restrict access to specific roles. Use after `protect`.
 * Example: router.delete('/:id', protect, authorize('admin'), handler)
 */
const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }
    next();
  };
};

module.exports = { protect, authorize };
