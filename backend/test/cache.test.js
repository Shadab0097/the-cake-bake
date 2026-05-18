const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildKey,
  createCache,
  createMemoryCache,
  deserialize,
  normalizeMode,
  serialize,
} = require('../src/utils/cache');

class FakeRedisClient {
  constructor() {
    this.values = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async set(key, value, options) {
    this.values.set(key, value);
    if (options?.EX) {
      this.ttls.set(key, options.EX);
    }
  }

  async del(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      this.values.delete(key);
      this.ttls.delete(key);
    }
  }

  async *scanIterator({ MATCH }) {
    const prefix = MATCH.endsWith('*') ? MATCH.slice(0, -1) : MATCH;
    for (const key of this.values.keys()) {
      if (key.startsWith(prefix)) {
        yield key;
      }
    }
  }
}

test('cache key builder is deterministic and skips empty values', () => {
  assert.equal(
    buildKey('products:list', { sort: 'newest', category: 'cakes', page: 1, empty: '' }),
    'products:list:category=cakes&page=1&sort=newest'
  );
});

test('memory cache getOrSet caches values and collapses concurrent misses', async () => {
  const cache = createCache({
    mode: 'memory',
    memoryCache: createMemoryCache(),
  });

  let calls = 0;
  const factory = async () => {
    calls += 1;
    return { value: calls };
  };

  const [first, second] = await Promise.all([
    cache.getOrSet('catalog:home', factory, 60),
    cache.getOrSet('catalog:home', factory, 60),
  ]);
  const third = await cache.getOrSet('catalog:home', factory, 60);

  assert.deepEqual(first, { value: 1 });
  assert.deepEqual(second, { value: 1 });
  assert.deepEqual(third, { value: 1 });
  assert.equal(calls, 1);
});

test('Redis cache stores JSON payloads with namespace and TTL', async () => {
  const redis = new FakeRedisClient();
  const cache = createCache({
    mode: 'redis',
    keyPrefix: 'cake:cache',
    redisClientProvider: async () => redis,
  });

  await cache.set('products:featured:12', [{ name: 'Cake' }], 120);
  const value = await cache.get('products:featured:12');

  assert.deepEqual(value, [{ name: 'Cake' }]);
  assert.equal(redis.ttls.get('cake:cache:products:featured:12'), 120);
  assert.equal(deserialize(redis.values.get('cake:cache:products:featured:12'))[0].name, 'Cake');
});

test('Redis cache invalidates only matching prefixed catalog keys', async () => {
  const redis = new FakeRedisClient();
  const cache = createCache({
    mode: 'redis',
    keyPrefix: 'cake:cache',
    redisClientProvider: async () => redis,
  });

  await cache.set('products:list', { products: [] }, 60);
  await cache.set('products:slug:chocolate', { name: 'Chocolate' }, 60);
  await cache.set('categories:list', [{ name: 'Cakes' }], 60);

  await cache.invalidatePattern('products:');

  assert.equal(await cache.get('products:list'), undefined);
  assert.equal(await cache.get('products:slug:chocolate'), undefined);
  assert.deepEqual(await cache.get('categories:list'), [{ name: 'Cakes' }]);
});

test('Redis cache failures fail open to the factory result', async () => {
  const cache = createCache({
    mode: 'redis',
    redisClientProvider: async () => {
      throw new Error('redis down');
    },
    log: { warn() {}, debug() {} },
  });

  const value = await cache.getOrSet('products:list', async () => ({ fresh: true }), 60);

  assert.deepEqual(value, { fresh: true });
});

test('cache serialization helpers and mode normalization are stable', () => {
  assert.deepEqual(deserialize(serialize({ a: 1 })), { a: 1 });
  assert.equal(normalizeMode('redis'), 'redis');
  assert.equal(normalizeMode('memory'), 'memory');
  assert.equal(normalizeMode('other'), 'memory');
});
