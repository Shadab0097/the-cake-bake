const NodeCache = require('node-cache');
const logger = require('../middleware/logger');

/**
 * In-memory cache with TTL support.
 * Used to cache frequently-accessed, rarely-changing data like
 * product listings, categories, delivery zones, and admin dashboard stats.
 *
 * Default TTL: 60 seconds
 * Check period: every 120 seconds for expired keys
 */
const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,      // Return references for performance (don't deep-clone)
  deleteOnExpire: true,
});

// Log cache stats periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = cache.getStats();
    if (stats.keys > 0) {
      logger.debug(`Cache stats — keys: ${stats.keys}, hits: ${stats.hits}, misses: ${stats.misses}, hitRate: ${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(1)}%`);
    }
  }, 300000); // Every 5 minutes
}

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {*} Cached value or undefined
 */
const get = (key) => {
  return cache.get(key);
};

/**
 * Set a value in cache
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} [ttl] - TTL in seconds (overrides default)
 */
const set = (key, value, ttl) => {
  if (ttl !== undefined) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
};

/**
 * Delete a specific key from cache
 * @param {string} key - Cache key to delete
 */
const del = (key) => {
  cache.del(key);
};

/**
 * Invalidate all keys matching a prefix pattern
 * Example: invalidatePattern('products:') clears all product cache
 * @param {string} prefix - Key prefix to match
 */
const invalidatePattern = (prefix) => {
  const keys = cache.keys();
  const matching = keys.filter((key) => key.startsWith(prefix));
  if (matching.length > 0) {
    cache.del(matching);
    logger.debug(`Cache invalidated ${matching.length} keys with prefix "${prefix}"`);
  }
};

/**
 * Flush the entire cache
 */
const flush = () => {
  cache.flushAll();
  logger.debug('Cache flushed');
};

/**
 * Get-or-set: returns cached value if exists, otherwise calls the
 * factory function, caches the result, and returns it.
 * @param {string} key - Cache key
 * @param {Function} factory - Async function to produce the value if cache miss
 * @param {number} [ttl] - TTL in seconds
 * @returns {*} Cached or freshly computed value
 */
const getOrSet = async (key, factory, ttl) => {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const value = await factory();
  set(key, value, ttl);
  return value;
};

/**
 * Build a deterministic cache key from query parameters
 * @param {string} prefix - Key prefix (e.g., 'products:list')
 * @param {Object} params - Query parameters
 * @returns {string} Cache key
 */
const buildKey = (prefix, params = {}) => {
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sorted ? `${prefix}:${sorted}` : prefix;
};

module.exports = { get, set, del, invalidatePattern, flush, getOrSet, buildKey };
