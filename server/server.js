const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);
const app = require('./src/app');
const connectDB = require('./src/config/db');
const env = require('./src/config/env');
const { ensurePortAvailable } = require('./src/utils/portRecovery');

let isStarting = false;
let hasStarted = false;
let serverInstance = null;

const startServer = async () => {
  // Prevent duplicate startup/listen executions
  if (isStarting || hasStarted) {
    // eslint-disable-next-line no-console
    console.warn('[server] Server startup already initiated. Skipping duplicate call.');
    return serverInstance;
  }
  isStarting = true;

  try {
    await connectDB();
    // Recover any stale running records left over from previous process shutdown
    try {
      const Analysis = require('./src/models/Analysis');
      await Analysis.updateMany(
        { status: 'running' },
        { status: 'failed', error: 'Server restarted while analysis was in progress.' }
      );
    } catch (_e) {
      // Non-fatal
    }
  } catch (error) {
    // A persistent local/traditional server can't do anything useful without
    // a database connection, so exit here (connectDB itself no longer exits,
    // since it's also reused by the Vercel serverless entry point in api/).
    // eslint-disable-next-line no-console
    console.error('[server] Failed to connect to MongoDB. Exiting.');
    process.exit(1);
  }

  // Safe development-time recovery: check if port is held by a previous DevPlatform process
  const isDev = env.nodeEnv !== 'production';
  const portReady = await ensurePortAvailable(env.port, isDev);
  if (!portReady) {
    // eslint-disable-next-line no-console
    console.error(`[server] Port ${env.port} could not be allocated. Exiting.`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    hasStarted = true;
    isStarting = false;
    // eslint-disable-next-line no-console
    console.log(`[server] Running in ${env.nodeEnv} mode on port ${env.port}`);
  });

  serverInstance = server;

  // Graceful EADDRINUSE handling to prevent unhandled Node.js crash
  server.on('error', (err) => {
    isStarting = false;
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(`\n[server] Error: Port ${env.port} is already in use (EADDRINUSE).`);
      // eslint-disable-next-line no-console
      console.error(`[server] Another application is currently listening on port ${env.port}. Please stop it or configure a different PORT in server/.env.\n`);
      process.exit(1);
    } else {
      // eslint-disable-next-line no-console
      console.error(`[server] Server error: ${err.message}`);
      process.exit(1);
    }
  });

  // Graceful shutdown on termination signals (SIGINT, SIGTERM, nodemon SIGUSR2)
  let isShuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`[server] Received ${signal}. Closing HTTP server...`);
    if (server && server.listening) {
      server.close(() => {
        // eslint-disable-next-line no-console
        console.log('[server] HTTP server closed cleanly.');
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1200).unref();
    } else {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

  // Graceful shutdown on unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    // eslint-disable-next-line no-console
    console.error(`[server] Unhandled rejection: ${err.message}`);
    if (server && server.listening) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  return server;
};

startServer();

module.exports = { startServer, app };
