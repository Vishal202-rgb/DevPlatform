const asyncHandler = require('express-async-handler');
const ApiError = require('../utils/ApiError');
const { setTokenCookie } = require('../utils/generateToken');
const authService = require('../services/authService');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are all required');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  const { user, token } = await authService.registerUser({ name, email, password });
  setTokenCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user, token },
  });
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const { user, token } = await authService.loginUser({ email, password });
  setTokenCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully',
    data: { user, token },
  });
});

// @desc    Log the user out (clear cookie)
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (_req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @desc    Get the currently authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, data: { user } });
});

module.exports = { register, login, logout, getMe };
