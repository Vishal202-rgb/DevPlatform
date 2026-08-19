const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generate a signed JWT for a given user id.
 * @param {string} userId
 * @returns {string} signed token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

/**
 * Attach the JWT as an httpOnly cookie on the response.
 */
const setTokenCookie = (res, token) => {
  const expiresInMs = env.jwtCookieExpiresDays * 24 * 60 * 60 * 1000;
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    expires: new Date(Date.now() + expiresInMs),
  });
};

module.exports = { generateToken, setTokenCookie };
