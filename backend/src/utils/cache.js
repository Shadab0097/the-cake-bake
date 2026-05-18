const NodeCache = require('node-cache');
const { env } = require('../config/env');
const { getRedisClient } = require('../config/redis');
const logger = require('../middleware/logger');

const createMemoryCache = () => new NodeCache({
  stdTTL: env.cache.defaultTtlSeconds,
  checkperiod: 120,
  useClones: false,
  deleteOnExpire: true,
});

const defaultMemoryCache = createMemoryCache();

if (process.env.NODE_ENV === 'development') {
  const statsInterval = setInterval(() => {
    const stats = defaultMemoryCache.getStats();
    if (stats.keys > 0) {
      const total = stats.hits + stats.misses;
      const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : '0.0';
      logger.debug(`Cache stats - keys: ${stats.keys}, hits: ${stats.hits}, misses: ${stats.misses}, hitRate: ${hitRate}%`);
    }
  }, 300000);
  statsInterval.unref?.();
}

const normalizeMode = (mode) => (
  String(mode || '').trim().toLowerCase() === 'redis' ? 'redis' : 'memory'
);

const serialize = (value) => JSON.stringify({ value });

const deserialize = (raw) => {
  if (raw === null || raw === undefined) return undefined;
  return JSON.parse(raw).value;
};

const createCache = ({
  mode = env.cache.store,
  keyPrefix = `${env.redis.keyPrefix}:cache`,
  memoryCache = defaultMemoryCache,
  redisClientProvider = getRedisClient,
  log = logger,
} = {}) => {
  const cacheMode = normalizeMode(mode);
  const inFlight = new Map();
  const redisKey = (key) => `${keyPrefix}:${key}`;

  const getRedis = async () => {
    const client = await redisClientProvider();
    if (!client) throw new Error('Redis cache is not configured');
    return client;
  };

  const get = async (key) => {
    if (cacheMode !== 'redis') {
      return memoryCache.get(key);
    }

    try {
      const client = await getRedis();
      return deserialize(await client.get(redisKey(key)));
    } catch (err) {
      log.warn(`[Cache] Redis get failed for ${key}: ${err.message}`);
      return undefined;
    }
  };

  const set = async (key, value, ttl = env.cache.defaultTtlSeconds) => {
    if (cacheMode !== 'redis') {
      if (ttl !== undefined) {
        memoryCache.set(key, value, ttl);
      } else {
        memoryCache.set(key, value);
      }
      return;
    }

    try {
      const client = await getRedis();
      const payload = serialize(value);
      if (ttl !== undefined && ttl > 0) {
        await client.set(redisKey(key), payload, { EX: ttl });
      } else {
        await client.set(redisKey(key), payload);
      }
    } catch (err) {
      log.warn(`[Cache] Redis set failed for ${key}: ${err.message}`);
    }
  };

  const del = async (key) => {
    memoryCache.del(key);

    if (cacheMode !== 'redis') return;

    try {
      const client = await getRedis();
      await client.del(redisKey(key));
    } catch (err) {
      log.warn(`[Cache] Redis del failed for ${key}: ${err.message}`);
    }
  };

  const invalidatePattern = async (prefix) => {
    const memoryMatches = memoryCache.keys().filter((key) => key.startsWith(prefix));
    if (memoryMatches.length > 0) {
      memoryCache.del(memoryMatches);
      log.debug(`Cache invalidated ${memoryMatches.length} memory keys with prefix "${prefix}"`);
    }

    if (cacheMode !== 'redis') return;

    try {
      const client = await getRedis();
      const pattern = `${redisKey(prefix)}*`;
      const keys = [];

      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
        if (keys.length >= 500) {
          await client.del(keys.splice(0, keys.length));
        }
      }

      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (err) {
      log.warn(`[Cache] Redis invalidation failed for ${prefix}: ${err.message}`);
    }
  };

  const flush = async () => {
    memoryCache.flushAll();
    await invalidatePattern('');
    log.debug('Cache flushed');
  };

  const getOrSet = async (key, factory, ttl) => {
    const cached = await get(key);
    if (cached !== undefined) return cached;

    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const promise = (async () => {
      const value = await factory();
      await set(key, value, ttl);
      return value;
    })();

    inFlight.set(key, promise);

    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  };

  return {
    del,
    flush,
    get,
    getOrSet,
    invalidatePattern,
    set,
  };
};

const buildKey = (prefix, params = {}) => {
  const sorted = Object.keys(params)
    .sort()
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return sorted ? `${prefix}:${sorted}` : prefix;
};

const defaultCache = createCache();

module.exports = {
  ...defaultCache,
  buildKey,
  createCache,
  createMemoryCache,
  deserialize,
  normalizeMode,
  serialize,
};
