const { env } = require('../config/env');
const logger = require('../middleware/logger');

const queues = new Map();
const workers = [];
const inlineProcessors = new Map();

const isBullMode = () => env.jobs.queueMode === 'bullmq';

const loadBullMQ = () => {
  try {
    return require('bullmq');
  } catch (err) {
    if (env.isProd() || isBullMode()) {
      throw new Error('BullMQ package is not installed. Run npm install before production startup.');
    }
    return null;
  }
};

const buildRedisConnectionOptions = () => {
  if (!env.redis.url) {
    throw new Error('REDIS_URL is required for BullMQ job queues');
  }

  const url = new URL(env.redis.url);
  const db = url.pathname && url.pathname !== '/'
    ? Number(url.pathname.slice(1))
    : undefined;

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: url.protocol === 'rediss:' || env.redis.tls ? {} : undefined,
    maxRetriesPerRequest: null,
  };
};

const getQueue = (queueName) => {
  if (!isBullMode()) return null;

  if (!queues.has(queueName)) {
    const { Queue } = loadBullMQ();
    queues.set(queueName, new Queue(queueName, {
      connection: buildRedisConnectionOptions(),
      prefix: `${env.redis.keyPrefix}:jobs`,
      defaultJobOptions: {
        attempts: env.jobs.defaultAttempts,
        backoff: {
          type: 'exponential',
          delay: env.jobs.backoffMs,
        },
        removeOnComplete: {
          age: env.jobs.removeOnCompleteAgeSeconds,
          count: 10000,
        },
        removeOnFail: {
          age: env.jobs.removeOnFailAgeSeconds,
          count: 50000,
        },
      },
    }));
  }

  return queues.get(queueName);
};

const registerInlineProcessor = (queueName, processor) => {
  inlineProcessors.set(queueName, processor);
};

const add = async (queueName, jobName, data, options = {}) => {
  if (isBullMode()) {
    const queue = getQueue(queueName);
    return queue.add(jobName, data, options);
  }

  const processor = inlineProcessors.get(queueName);
  const job = {
    id: options.jobId || `${jobName}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    name: jobName,
    data,
  };

  if (processor && env.jobs.workerEnabled) {
    const timer = setTimeout(() => {
      processor(job).catch((err) => {
        logger.warn(`[Jobs] Inline job ${jobName} failed: ${err.message}`);
      });
    }, options.delay || 0);
    timer.unref?.();
  }

  return job;
};

const startWorker = (queueName, processor) => {
  registerInlineProcessor(queueName, processor);

  if (!env.jobs.workerEnabled) {
    logger.info(`[Jobs] Worker disabled for queue "${queueName}"`);
    return null;
  }

  if (!isBullMode()) {
    logger.info(`[Jobs] Inline worker registered for queue "${queueName}"`);
    return null;
  }

  const { Worker } = loadBullMQ();
  const worker = new Worker(queueName, processor, {
    connection: buildRedisConnectionOptions(),
    prefix: `${env.redis.keyPrefix}:jobs`,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    logger.debug(`[Jobs] ${queueName}:${job.name} completed (${job.id})`);
  });

  worker.on('failed', (job, err) => {
    logger.warn(`[Jobs] ${queueName}:${job?.name || 'unknown'} failed (${job?.id || 'unknown'}): ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`[Jobs] Worker error on "${queueName}": ${err.message}`);
  });

  workers.push(worker);
  logger.info(`[Jobs] BullMQ worker started for queue "${queueName}"`);
  return worker;
};

const close = async () => {
  await Promise.all(workers.splice(0).map((worker) => worker.close()));
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
  inlineProcessors.clear();
};

module.exports = {
  add,
  buildRedisConnectionOptions,
  close,
  getQueue,
  isBullMode,
  registerInlineProcessor,
  startWorker,
};
