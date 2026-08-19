const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    // A persistent local/traditional server can't do anything useful without
    // a database connection, so exit here (connectDB itself no longer exits,
    // since it's also reused by the Vercel serverless entry point in api/).
    // eslint-disable-next-line no-console
    console.error('[server] Failed to connect to MongoDB. Exiting.');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  // Graceful shutdown on unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    // eslint-disable-next-line no-console
    console.error(`[server] Unhandled rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
