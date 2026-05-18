const mongoose = require('mongoose');
const AdminAuditLog = require('../../models/AdminAuditLog');
const logger = require('../../middleware/logger');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

const REDACTED = '[REDACTED]';
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 80;
const REDACTED_KEY_PATTERN = /(password|token|secret|signature|authorization|cookie|otp|apikey|api_key|keysecret|webhooksecret)/i;

class AdminAuditService {
  sanitizeText(value, maxLength = MAX_STRING_LENGTH) {
    return String(value || '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  isObjectId(value) {
    return mongoose.Types.ObjectId.isValid(String(value || ''));
  }

  objectIdOrNull(value) {
    return this.isObjectId(value) ? value : null;
  }

  getClientIp(req = {}) {
    const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    return forwardedFor || req.ip || req.socket?.remoteAddress || '';
  }

  sanitizeValue(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 4) return '[TRUNCATED]';

    if (typeof value === 'string') return this.sanitizeText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();

    if (Array.isArray(value)) {
      const sanitized = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => this.sanitizeValue(item, depth + 1));
      if (value.length > MAX_ARRAY_ITEMS) {
        sanitized.push(`[${value.length - MAX_ARRAY_ITEMS} more item(s) omitted]`);
      }
      return sanitized;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
      const sanitized = {};
      for (const [key, nestedValue] of entries) {
        sanitized[key] = REDACTED_KEY_PATTERN.test(key)
          ? REDACTED
          : this.sanitizeValue(nestedValue, depth + 1);
      }
      const omitted = Object.keys(value).length - entries.length;
      if (omitted > 0) sanitized.__omittedKeys = omitted;
      return sanitized;
    }

    return this.sanitizeText(value);
  }

  sanitizeBody(body = {}) {
    const sanitized = this.sanitizeValue(body);
    if (Array.isArray(body.products)) {
      sanitized.products = `[${body.products.length} product(s)]`;
    }
    return sanitized || {};
  }

  flattenFields(value, prefix = '', fields = new Set()) {
    if (!value || typeof value !== 'object') return fields;

    if (Array.isArray(value)) {
      value.forEach((item, index) => this.flattenFields(item, `${prefix}[]${index < 1 ? '' : ''}`, fields));
      return fields;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      fields.add(path);
      if (nestedValue && typeof nestedValue === 'object') {
        this.flattenFields(nestedValue, path, fields);
      }
    }

    return fields;
  }

  changedFields(body = {}) {
    return [...this.flattenFields(body)]
      .filter((field) => !REDACTED_KEY_PATTERN.test(field))
      .slice(0, 100)
      .sort();
  }

  extractMetadata(req = {}, options = {}) {
    const body = req.body || {};
    const priceOrStockFields = this.changedFields(body).filter((field) => (
      /(^|\.)(price|basePrice|egglessExtraPrice|stock|minOrderAmount|maxDiscount|value|usageLimit|perUserLimit|points|status)$/i.test(field)
    ));

    return {
      ...options.metadata,
      routeParams: this.sanitizeValue(req.params || {}),
      query: this.sanitizeValue(req.query || {}),
      priceOrStockFields,
    };
  }

  buildAuditEntry(req = {}, options = {}, statusCode = 200) {
    const params = req.params || {};
    const resourceId = options.resourceIdParam ? params[options.resourceIdParam] : params.id;
    const parentResourceId = options.parentResourceIdParam ? params[options.parentResourceIdParam] : null;

    return {
      action: options.action,
      resourceType: options.resourceType,
      resourceId: this.objectIdOrNull(resourceId),
      parentResourceId: this.objectIdOrNull(parentResourceId),
      actor: req.user?._id || req.user?.id,
      actorEmail: this.normalizeEmail(req.user?.email),
      actorRole: req.user?.role || '',
      method: req.method || '',
      path: this.sanitizeText(req.originalUrl || req.url || '', 1000),
      statusCode,
      outcome: statusCode < 400 ? 'success' : 'failure',
      requestId: this.sanitizeText(req.id || req.headers?.['x-request-id'], 120),
      ip: this.sanitizeText(this.getClientIp(req), 120),
      userAgent: this.sanitizeText(req.headers?.['user-agent'], 500),
      changedFields: this.changedFields(req.body || {}),
      body: this.sanitizeBody(req.body || {}),
      metadata: this.extractMetadata(req, options),
    };
  }

  async record(entry) {
    if (!entry.actor) return null;

    try {
      return await AdminAuditLog.create(entry);
    } catch (error) {
      logger.warn(`[AdminAudit] Failed to persist ${entry.action}: ${error.message}`);
      return null;
    }
  }

  audit(action, options = {}) {
    const auditOptions = {
      ...options,
      action,
    };

    return (req, res, next) => {
      res.on('finish', () => {
        const entry = this.buildAuditEntry(req, auditOptions, res.statusCode);
        setImmediate(() => {
          this.record(entry);
        });
      });
      next();
    };
  }

  async list(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    if (query.action) filter.action = query.action;
    if (query.resourceType) filter.resourceType = query.resourceType;
    if (query.outcome) filter.outcome = query.outcome;
    if (query.actor && this.isObjectId(query.actor)) filter.actor = query.actor;
    if (query.resourceId && this.isObjectId(query.resourceId)) filter.resourceId = query.resourceId;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .populate('actor', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    return paginatedResponse(logs, total, page, limit);
  }
}

module.exports = new AdminAuditService();
