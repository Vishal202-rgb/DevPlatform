require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0 && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(
    `[env] Missing environment variables: ${missing.join(', ')}. Check your .env file against .env.example.`
  );
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtCookieExpiresDays: Number(process.env.JWT_COOKIE_EXPIRES_DAYS || 7),

  // GitHub OAuth (Part 2)
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  githubCallbackUrl:
    process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/github/callback',

  // Gemini AI analysis (Part 3)
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
};
