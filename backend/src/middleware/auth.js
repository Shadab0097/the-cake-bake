const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const cache = require('../utils/cache');

// Short-lived cache of the authenticated user to avoid a DB round-trip on every
// authenticated request (the hottest path at scale). role / isActive changes
// propagate within USER_CACHE_TTL_SECONDS; call invalidateUserCache(id) on
// account disable or role change for immediate effect.
const USER_CACHE_TTL_SECONDS = 30;
const userCacheKey = (id) => `user:${id}`;

const loadAuthUser = async (userId) => {
  const cached = await cache.get(userCacheKey(userId));
  if (cached) return User.hydrate(cached);

  const user = await User.findById(userId)
    .select('-passwordHash -refreshToken -adminRefreshToken')
    .lean();
  if (!user) return null;

  await cache.set(userCacheKey(userId), user, USER_CACHE_TTL_SECONDS);
  return User.hydrate(user);
};

const invalidateUserCache = (userId) => cache.del(userCacheKey(userId));

/**
 * Authenticate user via JWT Bearer token
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, env.jwt.secret);

    const user = await loadAuthUser(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (user.isActive === false) {
      throw ApiError.unauthorized('Your account has been disabled. Please contact support.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(ApiError.unauthorized('Token expired'));
    }
    next(error);
  }
};

/**
 * Optional auth — attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.jwt.secret);
      const user = await loadAuthUser(decoded.id);
      if (user && user.isActive !== false) {
        req.user = user;
      }
    }

    next();
  } catch {
    // Silently continue without user
    next();
  }
};

module.exports = { auth, optionalAuth, invalidateUserCache };
