const logger = require('./logger');
const ApiError = require('../utils/ApiError');
const operationalAlertService = require('../modules/monitoring/operationalAlert.service');
const applicationErrorEventService = require('../modules/monitoring/applicationErrorEvent.service');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Uploaded file is too large',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    const codes = {
      LIMIT_FILE_SIZE: 'FILE_TOO_LARGE',
      LIMIT_FILE_COUNT: 'TOO_MANY_FILES',
      LIMIT_UNEXPECTED_FILE: 'UNEXPECTED_FILE_FIELD',
    };
    error = ApiError.badRequest(
      messages[err.code] || err.message || 'File upload failed',
      err.field ? [{ field: err.field, code: codes[err.code] || 'FILE_UPLOAD_ERROR', message: messages[err.code] || 'File upload failed' }] : [],
      codes[err.code] || 'FILE_UPLOAD_ERROR'
    );
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      code: (e.kind ? `INVALID_${String(e.kind).toUpperCase()}` : 'INVALID_FIELD'),
      message: e.message,
    }));
    const firstField = errors[0]?.field;
    error = ApiError.badRequest(
      firstField ? `Invalid value for "${firstField}".` : 'One or more fields are invalid.',
      errors,
      'VALIDATION_ERROR'
    );
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const keyValue = err.keyValue || err.writeErrors?.[0]?.err?.keyValue || {};
    const field = Object.keys(keyValue)[0] || 'field';
    error = ApiError.conflict(
      `A record with this ${field} already exists.`,
      [{ field, code: 'DUPLICATE_VALUE', message: `${field} already exists` }],
      'DUPLICATE_VALUE'
    );
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(
      `Invalid value "${err.value}" for "${err.path}".`,
      [{ field: err.path, code: 'INVALID_IDENTIFIER', message: `Invalid ${err.path}: ${err.value}` }],
      'INVALID_IDENTIFIER'
    );
  }

  // If still not an ApiError, wrap it as an internal error.
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, [], err.stack);
  }

  // Log errors (after reclassification so client errors are not logged as 5xx)
  if (error.statusCode >= 500) {
    logger.error(`${error.statusCode} - ${error.message}`, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      stack: error.stack,
    });
    setImmediate(() => {
      applicationErrorEventService.recordFromError(error, req, error.statusCode).catch((eventError) => {
        logger.warn(`[ApplicationErrorEvent] Failed to record API error: ${eventError.message}`);
      });

      operationalAlertService.recordAlert({
        type: 'api_5xx_error',
        severity: 'critical',
        source: 'api',
        message: `${error.statusCode} ${error.message}`,
        dedupeKey: `api_5xx:${req.method}:${req.route?.path || req.originalUrl}:${error.message}`,
        metadata: {
          statusCode: error.statusCode,
          method: req.method,
          url: req.originalUrl,
          requestId: req.id || req.requestId || req.headers?.['x-request-id'] || '',
          ip: req.ip,
        },
      }).catch((alertError) => {
        logger.warn(`[OperationalAlert] Failed to record API error alert: ${alertError.message}`);
      });
    });
  } else {
    logger.warn(`${error.statusCode} - ${error.message}`, {
      url: req.originalUrl,
      method: req.method,
    });
  }

  // Ensure every per-field error entry carries a machine-readable code.
  const normalizedErrors = (error.errors || []).map((entry) => (
    entry && typeof entry === 'object' && !entry.code
      ? { ...entry, code: error.code }
      : entry
  ));

  const response = {
    success: false,
    code: error.code,
    message: error.message,
    ...(normalizedErrors.length > 0 && { errors: normalizedErrors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
