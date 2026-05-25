const crypto = require('crypto');

const ApplicationErrorEvent = require('../../models/ApplicationErrorEvent');
const logger = require('../../middleware/logger');
const { env } = require('../../config/env');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

const SENSITIVE_KEY_PATTERN = /(password|secret|token|signature|authorization|cookie|otp|api.?key|refresh|razorpay.*secret|webhook)/i;
const MAX_STRING_LENGTH = 1000;
const MAX_STACK_LENGTH = 6000;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 50;
const MAX_THROTTLE_KEYS = 1000;

const truncate = (value, maxLength = MAX_STRING_LENGTH) => {
  const text = String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const sanitizeValue = (value, depth = 0) => {
  if (value === null || value === undefined) return value;
  if (depth > 3) return '[TRUNCATED]';
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[${value.length - MAX_ARRAY_ITEMS} more item(s) omitted]`);
    return items;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    const sanitized = {};
    for (const [key, childValue] of entries) {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : sanitizeValue(childValue, depth + 1);
    }
    const omitted = Object.keys(value).length - entries.length;
    if (omitted > 0) sanitized.__omittedKeys = omitted;
    return sanitized;
  }

  return truncate(value);
};

const fingerprintFor = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

class ApplicationErrorEventService {
  constructor(deps = {}) {
    this.EventModel = deps.EventModel || ApplicationErrorEvent;
    this.logger = deps.logger || logger;
    this.config = deps.config || env.logging;
    this.throttle = new Map();
  }

  retentionMs() {
    return Math.max(1, this.config.applicationErrorRetentionDays || 14) * 24 * 60 * 60 * 1000;
  }

  throttleMs() {
    return Math.max(5, this.config.applicationErrorMinWriteIntervalSeconds || 60) * 1000;
  }

  pruneThrottle(now = Date.now()) {
    if (this.throttle.size <= MAX_THROTTLE_KEYS) return;
    for (const [key, value] of this.throttle.entries()) {
      if ((now - value.lastSeenAt) > 10 * this.throttleMs()) {
        this.throttle.delete(key);
      }
      if (this.throttle.size <= MAX_THROTTLE_KEYS) break;
    }
  }

  getWriteDecision(fingerprint, now = Date.now()) {
    this.pruneThrottle(now);
    const existing = this.throttle.get(fingerprint);
    if (!existing) {
      this.throttle.set(fingerprint, { lastWriteAt: now, lastSeenAt: now, suppressed: 0 });
      return { shouldWrite: true, suppressed: 0 };
    }

    existing.lastSeenAt = now;
    if ((now - existing.lastWriteAt) < this.throttleMs()) {
      existing.suppressed += 1;
      return { shouldWrite: false, suppressed: existing.suppressed };
    }

    const suppressed = existing.suppressed;
    existing.lastWriteAt = now;
    existing.suppressed = 0;
    return { shouldWrite: true, suppressed };
  }

  buildFromError(error = {}, req = {}, statusCode = 500) {
    const method = truncate(req.method || '', 12);
    const path = truncate(req.originalUrl || req.url || '', 1000);
    const route = truncate(req.route?.path || '', 500);
    const name = truncate(error.name || 'Error', 120);
    const message = truncate(error.message || 'Internal server error', 1000);
    const requestId = truncate(req.id || req.requestId || req.headers?.['x-request-id'] || '', 120);
    const processRole = truncate(env.processRole || process.env.PROCESS_ROLE || 'all', 40);
    const fingerprint = fingerprintFor({
      source: 'api',
      method,
      route: route || path.split('?')[0],
      statusCode,
      name,
      message,
    });

    return {
      level: statusCode >= 500 ? 'error' : 'warn',
      source: 'api',
      processRole,
      fingerprint,
      requestId,
      method,
      path,
      route,
      statusCode,
      name,
      message,
      stack: truncate(error.stack || '', MAX_STACK_LENGTH),
      user: req.user?._id || req.user?.id || null,
      userEmail: truncate(req.user?.email || '', 254).toLowerCase(),
      ip: truncate(req.ip || req.socket?.remoteAddress || '', 120),
      userAgent: truncate(req.headers?.['user-agent'] || '', 500),
      context: sanitizeValue({
        params: req.params || {},
        query: req.query || {},
        body: req.body || {},
      }),
    };
  }

  async recordFromError(error, req, statusCode = 500) {
    if (this.config.applicationErrorEventsEnabled === false) return null;
    if (statusCode < 500) return null;

    const event = this.buildFromError(error, req, statusCode);
    const decision = this.getWriteDecision(event.fingerprint);
    if (!decision.shouldWrite) return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.retentionMs());
    const increment = 1 + decision.suppressed;
    const windowStart = new Date(now.getTime() - this.throttleMs() * 5);

    try {
      return await this.EventModel.findOneAndUpdate(
        { fingerprint: event.fingerprint, lastSeenAt: { $gte: windowStart } },
        {
          $setOnInsert: {
            level: event.level,
            source: event.source,
            processRole: event.processRole,
            fingerprint: event.fingerprint,
            method: event.method,
            route: event.route,
            statusCode: event.statusCode,
            name: event.name,
            message: event.message,
            stack: event.stack,
            firstSeenAt: now,
            occurrenceCount: 0,
          },
          $set: {
            requestId: event.requestId,
            path: event.path,
            user: event.user,
            userEmail: event.userEmail,
            ip: event.ip,
            userAgent: event.userAgent,
            context: event.context,
            lastSeenAt: now,
            expiresAt,
          },
          $inc: { occurrenceCount: increment },
        },
        { upsert: true, new: true }
      );
    } catch (recordError) {
      this.logger.warn(`[ApplicationErrorEvent] Failed to persist error event: ${recordError.message}`);
      return null;
    }
  }

  async list(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    if (query.level) filter.level = query.level;
    if (query.source) filter.source = query.source;
    if (query.processRole) filter.processRole = query.processRole;
    if (query.requestId) filter.requestId = String(query.requestId).trim();
    if (query.fingerprint) filter.fingerprint = String(query.fingerprint).trim();
    if (query.statusCode) filter.statusCode = parseInt(query.statusCode, 10);
    if (query.path) filter.path = { $regex: truncate(query.path, 200), $options: 'i' };
    if (query.q) {
      const q = truncate(query.q, 200);
      filter.$or = [
        { message: { $regex: q, $options: 'i' } },
        { path: { $regex: q, $options: 'i' } },
        { requestId: q },
        { fingerprint: q },
      ];
    }
    if (query.from || query.to) {
      filter.lastSeenAt = {};
      if (query.from) filter.lastSeenAt.$gte = new Date(query.from);
      if (query.to) filter.lastSeenAt.$lte = new Date(query.to);
    }

    const [events, total] = await Promise.all([
      this.EventModel.find(filter)
        .populate('user', 'name email role')
        .sort({ lastSeenAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.EventModel.countDocuments(filter),
    ]);

    return paginatedResponse(events, total, page, limit);
  }
}

const service = new ApplicationErrorEventService();

module.exports = service;
module.exports.ApplicationErrorEventService = ApplicationErrorEventService;
module.exports.sanitizeValue = sanitizeValue;
module.exports.truncate = truncate;
