const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RedisRateLimitStore,
  createRateLimitStore,
  normalizeStoreMode,
} = require('../src/middleware/rateLimitStore');
const { validateEnv } = require('../src/config/env');

class FakeRedisClient {
  constructor() {
    this.values = new Map();
    this.expiries = new Map();
  }

  async eval(script, { keys, arguments: args }) {
    const key = keys[0];

    if (script.includes('INCR')) {
      const current = (this.values.get(key) || 0) + 1;
      this.values.set(key, current);

      let ttl = this.expiries.get(key) || -1;
      if (current === 1 || ttl < 0) {
        ttl = Number(args[0]);
        this.expiries.set(key, ttl);
      }

      return [current, ttl];
    }

    if (script.includes('DECR')) {
      if (!this.values.has(key)) return 0;

      const current = this.values.get(key) - 1;
      if (current <= 0) {
        this.values.delete(key);
        this.expiries.delete(key);
        return current;
      }

      this.values.set(key, current);
      return current;
    }

    throw new Error('Unexpected script');
  }

  async del(key) {
    this.values.delete(key);
    this.expiries.delete(key);
  }
}

test('Redis rate limit store increments with a stable window expiry', async () => {
  const redis = new FakeRedisClient();
  const store = new RedisRateLimitStore({
    prefix: 'cake:test',
    clientProvider: async () => redis,
  });
  store.init({ windowMs: 60000 });

  const first = await store.increment('203.0.113.1');
  const second = await store.increment('203.0.113.1');

  assert.equal(first.totalHits, 1);
  assert.equal(second.totalHits, 2);
  assert.equal(redis.values.get('cake:test:203.0.113.1'), 2);
  assert.equal(redis.expiries.get('cake:test:203.0.113.1'), 60000);
  assert.ok(first.resetTime instanceof Date);
});

test('Redis rate limit store supports decrement and reset for successful request skips', async () => {
  const redis = new FakeRedisClient();
  const store = new RedisRateLimitStore({
    prefix: 'cake:test',
    clientProvider: async () => redis,
  });
  store.init({ windowMs: 60000 });

  await store.increment('user-key');
  await store.increment('user-key');
  await store.decrement('user-key');

  assert.equal(redis.values.get('cake:test:user-key'), 1);

  await store.resetKey('user-key');
  assert.equal(redis.values.has('cake:test:user-key'), false);
});

test('rate limit store factory only creates Redis stores when requested', () => {
  assert.equal(normalizeStoreMode('redis'), 'redis');
  assert.equal(normalizeStoreMode('memory'), 'memory');
  assert.equal(normalizeStoreMode('anything-else'), 'memory');

  assert.equal(createRateLimitStore('api', { storeMode: 'memory' }), undefined);

  const store = createRateLimitStore('api', {
    storeMode: 'redis',
    redisKeyPrefix: 'cake',
    clientProvider: async () => new FakeRedisClient(),
  });

  assert.ok(store instanceof RedisRateLimitStore);
  assert.equal(store.prefix, 'cake:rate-limit:api');
  assert.equal(store.localKeys, false);
});

test('Redis rate limit store fails closed when no client is available', async () => {
  const store = new RedisRateLimitStore({
    prefix: 'cake:test',
    clientProvider: async () => null,
  });

  await assert.rejects(
    () => store.increment('203.0.113.2'),
    /not configured/
  );
});

test('production environment validation requires Redis URL for distributed limits', () => {
  const originalEnv = { ...process.env };

  try {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_SECRET = 'prod-access-token-signing-key-64chars-a1b2c3d4e5f6';
    process.env.JWT_REFRESH_SECRET = 'prod-refresh-token-signing-key-64chars-f6e5d4c3b2a1';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey';
    process.env.RAZORPAY_KEY_SECRET = 'razorpay-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';
    process.env.CORS_ORIGIN = 'https://thecakebake.in';
    process.env.APP_URL = 'https://thecakebake.in';
    process.env.HEALTH_CHECK_TOKEN = 'health-token-32-characters-min';
    process.env.CLOUDINARY_CLOUD_NAME = 'cakebake';
    process.env.CLOUDINARY_API_KEY = 'cloudinary-key';
    process.env.CLOUDINARY_API_SECRET = 'cloudinary-secret';
    process.env.WHATSAPP_APP_SECRET = 'meta-secret';
    process.env.JOB_QUEUE_MODE = 'bullmq';
    delete process.env.REDIS_URL;

    assert.throws(
      () => validateEnv(),
      /REDIS_URL/
    );

    process.env.REDIS_URL = 'redis://localhost:6379';
    assert.doesNotThrow(() => validateEnv());
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!Object.hasOwn(originalEnv, key)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }
});
