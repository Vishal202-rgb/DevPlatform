
const mongoose = require('mongoose');
const env = require('./env');

// Cache the connection promise at module scope. In serverless environments
// (Vercel) the module can stay warm across invocations, so this avoids
// opening a new MongoDB connection on every request. Locally, this just
// means connectDB() is a no-op after the first successful call.
let cachedConnectionPromise = null;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (!cachedConnectionPromise) {
    mongoose.set('strictQuery', true);
    cachedConnectionPromise = mongoose
      .connect(env.mongoUri)
      .then((conn) => {
        // eslint-disable-next-line no-console
        console.log(`[db] MongoDB connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((error) => {
        cachedConnectionPromise = null; // allow the next call to retry
        // eslint-disable-next-line no-console
        console.error(`[db] Connection error: ${error.message}`);
        throw error;
      });
  }

  return cachedConnectionPromise;
};

module.exports = connectDB;
