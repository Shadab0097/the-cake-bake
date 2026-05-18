const { env } = require('../config/env');
const { getRedisClient } = require('../config/redis');

const INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if current == 1 or ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

const DECREMENT_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 0 then
  return 0
end
local current = redis.call("DECR", KEYS[1])
if current <= 0 then
  redis.call("DEL", KEYS[1])
end
return current
`;

class RedisRateLimitStore {
  constructor({ prefix, clientProvider = getRedisClient } = {}) {
    if (!prefix) {
      throw new Error('RedisRateLimitStore requires a key prefix');
    }

    this.prefix = prefix;
    this.clientProvider = clientProvider;
    this.windowMs = 60 * 1000;
    this.localKeys = false;
  }

  init(options = {}) {
    if (Number.isFinite(options.windowMs) && options.windowMs > 0) {
      this.windowMs = options.windowMs;
    }
  }

  buildKey(key) {
    return `${this.prefix}:${key}`;
  }

  async getClient() {
    const client = await this.clientProvider();
    if (!client) {
      throw new Error('Redis rate limit store is not configured');
    }
    return client;
  }

  async increment(key) {
    const client = await this.getClient();
    const redisKey = this.buildKey(key);
    const result = await client.eval(INCREMENT_SCRIPT, {
      keys: [redisKey],
      arguments: [String(this.windowMs)],
    });

    const totalHits = Number(result?.[0] || 0);
    const ttlMs = Number(result?.[1] || this.windowMs);

    return {
      totalHits,
      resetTime: new Date(Date.now() + Math.max(ttlMs, 0)),
    };
  }

  async decrement(key) {
    const client = await this.getClient();
    await client.eval(DECREMENT_SCRIPT, {
      keys: [this.buildKey(key)],
      arguments: [],
    });
  }

  async resetKey(key) {
    const client = await this.getClient();
    await client.del(this.buildKey(key));
  }
}

const normalizeStoreMode = (storeMode) => (
  String(storeMode || '').trim().toLowerCase() === 'redis' ? 'redis' : 'memory'
);

const createRateLimitStore = (name, {
  storeMode = env.rateLimit.store,
  redisKeyPrefix = env.redis.keyPrefix,
  clientProvider,
} = {}) => {
  const mode = normalizeStoreMode(storeMode);
  if (mode !== 'redis') return undefined;

  return new RedisRateLimitStore({
    prefix: `${redisKeyPrefix}:rate-limit:${name}`,
    clientProvider,
  });
};

module.exports = {
  RedisRateLimitStore,
  createRateLimitStore,
  normalizeStoreMode,
};
