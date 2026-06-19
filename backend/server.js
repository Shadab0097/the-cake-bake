const { PROCESS_ROLES, env, validateEnv } = require('./src/config/env');

// Validate environment variables before starting any runtime role.
validateEnv();

const connectDB = require('./src/config/db');
const { closeRedisClient, connectRedisIfConfigured } = require('./src/config/redis');
const logger = require('./src/middleware/logger');
const orderExpiryJob = require('./src/jobs/orderExpiry.job');
const paymentReconciliationJob = require('./src/jobs/paymentReconciliation.job');
const inventoryReservationExpiryJob = require('./src/jobs/inventoryReservationExpiry.job');
const dailyReportJob = require('./src/jobs/dailyReport.job');
const jobQueue = require('./src/jobs/jobQueue.service');
const notificationWorker = require('./src/jobs/notificationWorker');

const ROLE_CAPABILITIES = {
  [PROCESS_ROLES.ALL]: { web: true, worker: true, scheduler: true },
  [PROCESS_ROLES.WEB]: { web: true, worker: false, scheduler: false },
  [PROCESS_ROLES.WORKER]: { web: false, worker: true, scheduler: false },
  [PROCESS_ROLES.SCHEDULER]: { web: false, worker: false, scheduler: true },
};

let server = null;
let shutdownStarted = false;
const stopCallbacks = [];

const logStartup = () => {
  logger.info(
    [
      '',
      '==================================================',
      'The Cake Bake backend started',
      `Environment: ${env.nodeEnv}`,
      `Process role: ${env.processRole}`,
      `Queue mode: ${env.jobs.queueMode}`,
      `API URL: http://localhost:${env.port}/api/v1`,
      '==================================================',
    ].join('\n')
  );
};

const startWebServer = async () => {
  const app = require('./src/app');

  return new Promise((resolve, reject) => {
    const listeningServer = app.listen(env.port, () => {
      server = listeningServer;
      logger.info(`[Runtime] Web server listening on port ${env.port}`);
      resolve();
    });

    listeningServer.once('error', reject);
  });
};

const startScheduler = () => {
  stopCallbacks.push(orderExpiryJob.start());
  stopCallbacks.push(paymentReconciliationJob.start());
  stopCallbacks.push(inventoryReservationExpiryJob.start());
  stopCallbacks.push(dailyReportJob.start());
};

const startNotificationWorker = () => {
  if (env.processRole === PROCESS_ROLES.WORKER && !jobQueue.isBullMode()) {
    throw new Error('PROCESS_ROLE=worker requires JOB_QUEUE_MODE=bullmq and REDIS_URL. Use PROCESS_ROLE=all for inline local development.');
  }

  notificationWorker.start();
};

const closeWebServer = async () => {
  if (!server) return;

  const activeServer = server;

  await new Promise((resolve, reject) => {
    let drainTimer = null;

    activeServer.close((err) => {
      if (drainTimer) clearInterval(drainTimer);
      if (err) reject(err);
      else resolve();
    });

    // server.close() stops accepting new connections but does NOT terminate
    // idle HTTP keep-alive sockets. Behind a load balancer that pools keep-alive
    // connections this leaves close() pending until the force-exit timer fires,
    // making every deploy stall ~10s and risking force-killed in-flight requests.
    // Repeatedly close idle sockets (Node >= 18.2) so connections drop as soon as
    // their in-flight request finishes and goes idle, letting close() complete
    // promptly while still draining active requests.
    if (typeof activeServer.closeIdleConnections === 'function') {
      activeServer.closeIdleConnections();
      drainTimer = setInterval(() => activeServer.closeIdleConnections(), 500);
      drainTimer.unref?.();
    }
  });

  server = null;
  logger.info('[Runtime] Web server closed');
};

const shutdown = async (signal, exitCode = 0) => {
  if (shutdownStarted) return;
  shutdownStarted = true;

  logger.info(`${signal} received. Shutting down role "${env.processRole}" gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref?.();

  try {
    for (const stop of stopCallbacks.splice(0)) {
      try {
        stop?.();
      } catch (err) {
        logger.warn(`[Runtime] Failed to stop scheduler callback: ${err.message}`);
      }
    }

    await closeWebServer();
    await jobQueue.close();
    await closeRedisClient();
    await connectDB.closeDB();
    clearTimeout(forceExit);
    logger.info('Shutdown complete');
    process.exit(exitCode);
  } catch (err) {
    logger.error('Shutdown failed:', err);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    const capabilities = ROLE_CAPABILITIES[env.processRole];

    if (!capabilities) {
      throw new Error(`Unsupported PROCESS_ROLE "${env.processRole}"`);
    }

    if (env.isProd() && env.processRole === PROCESS_ROLES.ALL) {
      logger.warn('[Runtime] PROCESS_ROLE=all is convenient but not recommended for scaled production. Prefer web, worker, and scheduler as separate processes.');
    }

    if (capabilities.web && env.jobs.queueMode === 'inline' && env.processRole === PROCESS_ROLES.WEB) {
      logger.warn('[Runtime] PROCESS_ROLE=web with JOB_QUEUE_MODE=inline will enqueue notifications without processing them. Use PROCESS_ROLE=all locally or BullMQ with a worker process.');
    }

    await connectDB();
    await connectRedisIfConfigured();

    if (capabilities.web) {
      await startWebServer();
    }

    if (capabilities.scheduler) {
      startScheduler();
    }

    if (capabilities.worker) {
      startNotificationWorker();
    }

    logStartup();
  } catch (error) {
    logger.error('Failed to start runtime:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  shutdown('UNHANDLED_REJECTION', 1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  shutdown('UNCAUGHT_EXCEPTION', 1);
});

startServer();
