const crypto = require('crypto');

/**
 * Request Correlation ID Middleware
 *
 * Attaches a unique `req.id` to every incoming request so that all
 * log entries for a single request can be traced end-to-end — including
 * fire-and-forget setImmediate tasks.
 *
 * Also sets `X-Request-Id` response header so callers can correlate
 * client-side errors with server logs.
 */
const requestId = (req, res, next) => {
  // Accept incoming ID from trusted proxy/load balancer, or generate a new one
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = requestId;
