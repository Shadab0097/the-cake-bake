/**
 * Cluster Mode Entry Point
 *
 * Uses Node.js cluster module to fork worker processes equal to CPU count.
 * This allows The Cake Bake API to utilize all CPU cores on a single server,
 * dramatically increasing throughput for concurrent requests.
 *
 * Usage:
 *   Production:  NODE_ENV=production node cluster.js
 *   Development: node src/server.js  (single process, as before)
 *
 * Features:
 *   - Automatic worker restart on crash (with backoff)
 *   - Graceful shutdown on SIGTERM/SIGINT
 *   - Configurable worker count via CLUSTER_WORKERS env var
 */

const cluster = require('cluster');
const os = require('os');

const WORKER_COUNT = parseInt(process.env.CLUSTER_WORKERS, 10) || os.cpus().length;
const MAX_RESTART_DELAY = 30000; // 30 seconds max backoff

if (cluster.isPrimary) {
  console.log(`[Cluster] Primary process ${process.pid} starting ${WORKER_COUNT} workers...`);

  // Track restart attempts per worker for backoff
  const restartAttempts = {};

  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} is online`);
    restartAttempts[worker.id] = 0;
  });

  cluster.on('exit', (worker, code, signal) => {
    const workerId = worker.id;
    const attempts = (restartAttempts[workerId] || 0) + 1;
    restartAttempts[workerId] = attempts;

    // Exponential backoff: 1s, 2s, 4s, 8s, ... up to MAX_RESTART_DELAY
    const delay = Math.min(1000 * Math.pow(2, attempts - 1), MAX_RESTART_DELAY);

    if (signal) {
      console.log(`[Cluster] Worker ${worker.process.pid} killed by signal ${signal}. Restarting in ${delay}ms...`);
    } else if (code !== 0) {
      console.log(`[Cluster] Worker ${worker.process.pid} exited with code ${code}. Restarting in ${delay}ms (attempt ${attempts})...`);
    } else {
      console.log(`[Cluster] Worker ${worker.process.pid} exited gracefully.`);
      return; // Don't restart graceful exits
    }

    setTimeout(() => {
      const newWorker = cluster.fork();
      restartAttempts[newWorker.id] = attempts;
    }, delay);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n[Cluster] ${signal} received. Shutting down ${Object.keys(cluster.workers).length} workers...`);
    for (const id in cluster.workers) {
      cluster.workers[id].process.kill('SIGTERM');
    }
    setTimeout(() => {
      console.log('[Cluster] Forcing exit after timeout');
      process.exit(0);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

} else {
  // Worker process — load the actual server
  require('./server');
}
