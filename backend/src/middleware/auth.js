const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

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

    const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');

    if (!user) {
      throw ApiError.unauthorized('User not found');
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
      const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch {
    // Silently continue without user
    next();
  }
};

module.exports = { auth, optionalAuth };
