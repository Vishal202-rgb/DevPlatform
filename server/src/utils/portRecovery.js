const net = require('net');
const http = require('http');
const { execSync } = require('child_process');

/**
 * Checks if a TCP port is currently occupied.
 * @param {number|string} port
 * @returns {Promise<boolean>}
 */
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const numPort = Number(port);
    const tester = net
      .createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(numPort);
  });
};

/**
 * Finds the listening PID on a given port.
 * @param {number|string} port
 * @returns {number|null}
 */
const findPidOnPort = (port) => {
  try {
    const numPort = Number(port);
    if (process.platform === 'win32') {
      const output = execSync('netstat -ano -p tcp', {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      }).toString();

      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes(`:${numPort}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (pid && !isNaN(pid) && pid !== process.pid) {
            return pid;
          }
        }
      }
    } else {
      const output = execSync(`lsof -i :${numPort} -t`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      const pid = parseInt(output.split('\n')[0], 10);
      if (pid && !isNaN(pid) && pid !== process.pid) {
        return pid;
      }
    }
  } catch (_e) {
    // Non-fatal
  }
  return null;
};

/**
 * Verifies if a process ID belongs to a Node.js process.
 * @param {number} pid
 * @returns {boolean}
 */
const isNodeProcess = (pid) => {
  if (!pid) return false;
  try {
    if (process.platform === 'win32') {
      const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      }).toString();
      return output.toLowerCase().includes('node.exe');
    } else {
      const output = execSync(`ps -p ${pid} -o comm=`, {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      return output.toLowerCase().includes('node');
    }
  } catch (_e) {
    return false;
  }
};

/**
 * Probes the local health endpoint to verify if the server is DevPlatform.
 * @param {number|string} port
 * @returns {Promise<boolean>}
 */
const isDevPlatformEndpoint = (port) => {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/api/health`,
      {
        timeout: 1200,
        headers: { Connection: 'close' },
        agent: false,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            resolve(
              data &&
                (data.message === 'API is healthy' || data.success === true)
            );
          } catch (_e) {
            resolve(false);
          }
        });
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
};

/**
 * Safely recovers port 5000 in development if occupied by an orphaned DevPlatform process.
 * Does NOT terminate unrelated external processes.
 * @param {number|string} port
 * @param {boolean} isDev
 * @returns {Promise<boolean>} true if port is available (or recovered), false otherwise
 */
const ensurePortAvailable = async (port, isDev = true) => {
  let pid = findPidOnPort(port);
  let inUse = pid ? true : await isPortInUse(port);
  if (!inUse) {
    return true;
  }

  // If in use but no active PID was found, the socket is likely in TIME_WAIT / closing.
  // Wait up to 1.5 seconds for it to release cleanly.
  if (!pid) {
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      inUse = await isPortInUse(port);
      if (!inUse) {
        return true;
      }
      pid = findPidOnPort(port);
      if (pid) break;
    }
    if (!inUse) {
      return true;
    }
  }

  // In production, never attempt auto-recovery
  if (!isDev) {
    console.error(`[server] Port ${port} is already in use by process PID ${pid || 'unknown'}.`);
    return false;
  }

  // In development, check if it's an existing DevPlatform process
  const isDevPlat = await isDevPlatformEndpoint(port);
  const isNode = isNodeProcess(pid);

  if (pid && (isDevPlat || isNode)) {
    console.warn(`[server] Port ${port} is currently held by a previous DevPlatform process (PID ${pid}).`);
    console.log(`[server] Safely releasing port ${port} for fresh startup...`);
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /PID ${pid}`, {
          stdio: 'ignore',
          windowsHide: true,
        });
      } else {
        process.kill(pid, 'SIGKILL');
      }

      // Poll up to 2 seconds for OS to release the socket
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const stillInUse = await isPortInUse(port);
        if (!stillInUse) {
          console.log(`[server] Port ${port} has been successfully released.`);
          return true;
        }
      }
    } catch (err) {
      console.error(`[server] Failed to terminate stale process PID ${pid}: ${err.message}`);
    }
  } else {
    console.error(`[server] Port ${port} is already in use by an external application (PID ${pid || 'unknown'}).`);
    console.error(`[server] DevPlatform will not terminate unrelated processes. Please free port ${port} or change PORT in server/.env.`);
  }

  return false;
};

module.exports = {
  isPortInUse,
  findPidOnPort,
  isNodeProcess,
  isDevPlatformEndpoint,
  ensurePortAvailable,
};
