const crypto = require('crypto');
const axios = require('axios');

const OperationalAlert = require('../../models/OperationalAlert');
const logger = require('../../middleware/logger');
const { env } = require('../../config/env');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

const SENSITIVE_KEY_PATTERN = /(password|secret|token|signature|authorization|cookie|api.?key|refresh)/i;

const truncate = (value, maxLength = 1000) => {
  const text = String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const sanitizeMetadata = (value, depth = 0) => {
  if (depth > 4) return '[MaxDepth]';
  if (value == null) return value;
  if (typeof value === 'string') return truncate(value, 1000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 50).reduce((acc, [key, childValue]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : sanitizeMetadata(childValue, depth + 1);
      return acc;
    }, {});
  }
  return truncate(value, 1000);
};

const fingerprint = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

class OperationalAlertService {
  constructor(deps = {}) {
    this.AlertModel = deps.AlertModel || OperationalAlert;
    this.httpClient = deps.httpClient || axios;
    this.logger = deps.logger || logger;
    this.config = deps.config || env.monitoring;
  }

  buildAlert(input = {}) {
    const metadata = sanitizeMetadata(input.metadata || {});
    const type = truncate(input.type || 'operational_alert', 120);
    const source = truncate(input.source || 'system', 120);
    const message = truncate(input.message || type, 1000);
    const severity = ['info', 'warning', 'critical'].includes(input.severity)
      ? input.severity
      : 'warning';
    const dedupeKey = truncate(input.dedupeKey || fingerprint({ type, source, message, metadata }), 300);

    return {
      type,
      severity,
      source,
      status: 'open',
      dedupeKey,
      message,
      metadata,
      lastSeenAt: new Date(),
    };
  }

  logAlert(alert) {
    const payload = JSON.stringify({
      type: alert.type,
      severity: alert.severity,
      source: alert.source,
      dedupeKey: alert.dedupeKey,
      message: alert.message,
    });

    if (alert.severity === 'critical') {
      this.logger.error(`[OperationalAlert] ${payload}`);
    } else if (alert.severity === 'warning') {
      this.logger.warn(`[OperationalAlert] ${payload}`);
    } else {
      this.logger.info(`[OperationalAlert] ${payload}`);
    }
  }

  shouldNotify(alert, now = new Date()) {
    if (!this.config.alertWebhookUrl) return false;
    if (!alert.notifiedAt) return true;

    const lastNotifiedAt = new Date(alert.notifiedAt).getTime();
    const cooldownMs = this.config.alertCooldownMinutes * 60 * 1000;
    return Number.isFinite(lastNotifiedAt) && (now.getTime() - lastNotifiedAt) >= cooldownMs;
  }

  async notifyWebhook(alert) {
    if (!this.shouldNotify(alert)) return { sent: false, reason: 'not_configured_or_cooling_down' };

    try {
      const headers = this.config.alertWebhookToken
        ? { Authorization: `Bearer ${this.config.alertWebhookToken}` }
        : {};

      await this.httpClient.post(this.config.alertWebhookUrl, {
        type: alert.type,
        severity: alert.severity,
        source: alert.source,
        message: alert.message,
        dedupeKey: alert.dedupeKey,
        metadata: alert.metadata,
        occurrenceCount: alert.occurrenceCount,
        lastSeenAt: alert.lastSeenAt,
      }, {
        timeout: this.config.alertWebhookTimeoutMs,
        headers,
      });

      if (alert._id) {
        await this.AlertModel.updateOne(
          { _id: alert._id },
          { $set: { notifiedAt: new Date(), lastNotificationError: '' } }
        );
      }

      return { sent: true };
    } catch (error) {
      const message = truncate(error.message || 'Webhook notification failed', 500);
      if (alert._id) {
        await this.AlertModel.updateOne(
          { _id: alert._id },
          { $set: { lastNotificationError: message } }
        ).catch(() => {});
      }
      this.logger.warn(`[OperationalAlert] Webhook notification failed: ${message}`);
      return { sent: false, reason: message };
    }
  }

  async recordAlert(input) {
    const alert = this.buildAlert(input);
    this.logAlert(alert);

    let persistedAlert = alert;
    try {
      persistedAlert = await this.AlertModel.findOneAndUpdate(
        { dedupeKey: alert.dedupeKey },
        {
          $setOnInsert: {
            type: alert.type,
            severity: alert.severity,
            source: alert.source,
            message: alert.message,
            firstSeenAt: alert.lastSeenAt,
          },
          $set: {
            status: 'open',
            metadata: alert.metadata,
            lastSeenAt: alert.lastSeenAt,
          },
          $inc: { occurrenceCount: 1 },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      this.logger.error(`[OperationalAlert] Failed to persist alert ${alert.type}: ${error.message}`);
    }

    await this.notifyWebhook(persistedAlert);
    return persistedAlert;
  }

  async recordPaymentMismatch({ order, payment, reason, source = 'payments', metadata = {} }) {
    const orderId = String(order?._id || payment?.order || 'unknown-order');
    const paymentId = String(payment?._id || payment?.razorpayPaymentId || payment?.razorpayOrderId || 'unknown-payment');
    return this.recordAlert({
      type: 'payment_order_mismatch',
      severity: 'critical',
      source,
      message: truncate(`Payment/order mismatch: ${reason}`, 1000),
      dedupeKey: `payment_order_mismatch:${orderId}:${paymentId}:${truncate(reason, 120)}`,
      metadata: {
        orderId,
        orderNumber: order?.orderNumber || '',
        orderStatus: order?.status || '',
        orderPaymentStatus: order?.paymentStatus || '',
        paymentId,
        razorpayOrderId: payment?.razorpayOrderId || '',
        razorpayPaymentId: payment?.razorpayPaymentId || '',
        paymentStatus: payment?.status || '',
        reason,
        ...metadata,
      },
    });
  }

  async list(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.type) filter.type = query.type;
    if (query.severity) filter.severity = query.severity;
    if (query.status) filter.status = query.status;

    const [alerts, total] = await Promise.all([
      this.AlertModel.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).lean(),
      this.AlertModel.countDocuments(filter),
    ]);

    return paginatedResponse(alerts, total, page, limit);
  }
}

const service = new OperationalAlertService();

module.exports = service;
module.exports.OperationalAlertService = OperationalAlertService;
module.exports.sanitizeMetadata = sanitizeMetadata;
