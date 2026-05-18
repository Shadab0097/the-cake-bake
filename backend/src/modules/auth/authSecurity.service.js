const SecurityEvent = require('../../models/SecurityEvent');
const logger = require('../../middleware/logger');

const ADMIN_SCOPE = 'admin';

class AuthSecurityService {
  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  normalizeScope(scope) {
    return scope === ADMIN_SCOPE ? ADMIN_SCOPE : 'customer';
  }

  isAdminLoginRequest(body = {}) {
    return this.normalizeScope(body.scope) === ADMIN_SCOPE;
  }

  sanitizeText(value, maxLength = 500) {
    return String(value || '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  getClientIp(req = {}) {
    const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    return forwardedFor || req.ip || req.socket?.remoteAddress || '';
  }

  requestContext(req = {}) {
    return {
      ip: this.sanitizeText(this.getClientIp(req), 120),
      userAgent: this.sanitizeText(req.headers?.['user-agent'], 500),
      requestId: this.sanitizeText(req.id || req.requestId || req.headers?.['x-request-id'], 120),
    };
  }

  buildEvent({ type, severity = 'warning', scope = 'admin', req = {}, user = null, email = '', reason = '', metadata = {} }) {
    const context = this.requestContext(req);
    const event = {
      type,
      severity,
      scope: this.normalizeScope(scope),
      user: user?._id || user?.id || user || null,
      email: this.normalizeEmail(email || req.body?.email),
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      reason: this.sanitizeText(reason, 500),
      metadata: {
        ...metadata,
      },
    };

    delete event.metadata.password;
    delete event.metadata.refreshToken;
    return event;
  }

  logMessage(event) {
    const payload = JSON.stringify({
      type: event.type,
      severity: event.severity,
      scope: event.scope,
      email: event.email,
      ip: event.ip,
      requestId: event.requestId,
      reason: event.reason,
    });

    if (event.severity === 'critical') {
      logger.error(`[Security] ${payload}`);
    } else if (event.severity === 'warning') {
      logger.warn(`[Security] ${payload}`);
    } else {
      logger.info(`[Security] ${payload}`);
    }
  }

  async recordEvent(input) {
    const event = this.buildEvent(input);
    this.logMessage(event);

    try {
      await SecurityEvent.create(event);
    } catch (error) {
      logger.warn(`[Security] Failed to persist event ${event.type}: ${error.message}`);
    }

    return event;
  }

  async recordAdminLoginSuccess(req, user) {
    return this.recordEvent({
      type: 'admin_login_success',
      severity: 'info',
      scope: ADMIN_SCOPE,
      req,
      user,
      email: user?.email || req.body?.email,
      reason: 'Admin login succeeded',
      metadata: {
        role: user?.role || '',
      },
    });
  }

  async recordAdminLoginFailure(req, error) {
    const statusCode = error?.statusCode || 500;
    const isSuspicious = statusCode === 403 || statusCode === 429 || statusCode >= 500;

    return this.recordEvent({
      type: 'admin_login_failed',
      severity: isSuspicious ? 'critical' : 'warning',
      scope: ADMIN_SCOPE,
      req,
      email: req.body?.email,
      reason: error?.message || 'Admin login failed',
      metadata: {
        statusCode,
      },
    });
  }

  async recordAdminLoginRateLimited(req) {
    return this.recordEvent({
      type: 'admin_login_rate_limited',
      severity: 'critical',
      scope: ADMIN_SCOPE,
      req,
      email: req.body?.email,
      reason: 'Admin login rate limit exceeded',
    });
  }
}

module.exports = new AuthSecurityService();
