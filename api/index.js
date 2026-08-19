// Vercel serverless entry point. This does NOT modify the Express app from
// Parts 1-3 (server/src/app.js) at all - it just wraps it so Vercel can
// invoke it as a function per-request instead of a long-running process.
// Local development still uses server/server.js (npm run dev), which is
// unaffected by this file.
const connectDB = require('../server/src/config/db');
const app = require('../server/src/app');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'Database connection failed. Check MONGO_URI in your Vercel project settings.',
      })
    );
    return;
  }

  return app(req, res);
};
