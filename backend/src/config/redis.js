const { env } = require('./env');
const logger = require('../middleware/logger');

let redisClient;
let redisClientPromise;

const loadRedisPackage = () => {
  try {
    return require('redis');
  } catch (err) {
    const message = 'Redis client package is not installed. Run npm install before production startup.';
    if (env.isProd() || env.rateLimit.store === 'redis') {
      throw new Error(message);
    }
    logger.warn(`[Redis] ${message}`);
    return null;
  }
};

const createRedisClient = () => {
  if (!env.redis.url) return null;

  const redis = loadRedisPackage();
  if (!redis) return null;

  const client = redis.createClient({
    url: env.redis.url,
    socket: {
      tls: env.redis.tls,
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });

  client.on('error', (err) => {
    logger.error(`[Redis] Client error: ${err.message}`);
  });

  client.on('reconnecting', () => {
    logger.warn('[Redis] Reconnecting...');
  });

  client.on('ready', () => {
    logger.info('[Redis] Connected');
  });

  return client;
};

const getRedisClient = async () => {
  if (!env.redis.url) return null;

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (!redisClientPromise) {
    redisClient = createRedisClient();
    redisClientPromise = redisClient
      .connect()
      .then(() => redisClient)
      .catch((err) => {
        redisClientPromise = null;
        throw err;
      });
  }

  return redisClientPromise;
};

const connectRedisIfConfigured = async () => {
  if (!env.redis.url) return null;
  return getRedisClient();
};

const closeRedisClient = async () => {
  if (!redisClient) return;

  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } finally {
    redisClient = null;
    redisClientPromise = null;
  }
};

module.exports = {
  connectRedisIfConfigured,
  closeRedisClient,
  getRedisClient,
};
