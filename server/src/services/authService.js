const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { generateToken } = require('../utils/generateToken');

/**
 * Register a new user.
 */
const registerUser = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists');
  }

  const user = await User.create({ name, email, password });
  const token = generateToken(user._id);

  return { user, token };
};

/**
 * Authenticate a user by email/password.
 */
const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = generateToken(user._id);
  return { user, token };
};

/**
 * Fetch the currently authenticated user.
 */
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return user;
};

module.exports = { registerUser, loginUser, getCurrentUser };
