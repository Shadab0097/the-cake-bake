const logger = require('./logger');
const ApiError = require('../utils/ApiError');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // If not an ApiError, wrap it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, [], err.stack);
  }

  // Log errors
  if (error.statusCode >= 500) {
    logger.error(`${error.statusCode} - ${error.message}`, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      stack: error.stack,
    });
  } else {
    logger.warn(`${error.statusCode} - ${error.message}`, {
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', errors);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const keyValue = err.keyValue || err.writeErrors?.[0]?.err?.keyValue || {};
    const field = Object.keys(keyValue)[0] || 'field';
    error = ApiError.conflict(`${field} already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  const response = {
    success: false,
    message: error.message,
    ...(error.errors.length > 0 && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
