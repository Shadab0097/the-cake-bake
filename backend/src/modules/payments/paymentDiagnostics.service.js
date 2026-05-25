const mongoose = require('mongoose');

const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Refund = require('../../models/Refund');
const RazorpayWebhookEvent = require('../../models/RazorpayWebhookEvent');
const OperationalAlert = require('../../models/OperationalAlert');
const ApplicationErrorEvent = require('../../models/ApplicationErrorEvent');
const AdminAuditLog = require('../../models/AdminAuditLog');
const { sanitizeValue, truncate } = require('../monitoring/applicationErrorEvent.service');

const MAX_RESULTS = 10;
const MAX_TIMELINE_ITEMS = 100;
const MAX_EMBEDDED_WEBHOOK_EVENTS = 50;

const normalize = (value = '') => String(value || '').trim();
const normalizeEmail = (value = '') => normalize(value).toLowerCase();
const digitsOnly = (value = '') => normalize(value).replace(/\D/g, '');
const isObjectId = (value = '') => mongoose.Types.ObjectId.isValid(String(value || ''));

const uniqueIds = (items = []) => [
  ...new Set(items.filter(Boolean).map((item) => String(item))),
];

const cleanPayment = (payment = {}) => {
  const sanitized = sanitizeValue(payment);
  delete sanitized.razorpaySignature;
  if (Array.isArray(sanitized.webhookEvents)) {
    sanitized.webhookEvents = sanitized.webhookEvents.slice(-MAX_EMBEDDED_WEBHOOK_EVENTS);
  }
  return sanitized;
};

const eventTime = (item = {}) => (
  item.at ||
  item.receivedAt ||
  item.processedAt ||
  item.lastSeenAt ||
  item.updatedAt ||
  item.createdAt ||
  item.timestamp ||
  new Date(0)
);

class PaymentDiagnosticsService {
  constructor(deps = {}) {
    this.OrderModel = deps.OrderModel || Order;
    this.PaymentModel = deps.PaymentModel || Payment;
    this.RefundModel = deps.RefundModel || Refund;
    this.WebhookEventModel = deps.WebhookEventModel || RazorpayWebhookEvent;
    this.AlertModel = deps.AlertModel || OperationalAlert;
    this.ErrorEventModel = deps.ErrorEventModel || ApplicationErrorEvent;
    this.AuditLogModel = deps.AuditLogModel || AdminAuditLog;
  }

  buildSearch(query = {}) {
    const q = normalize(query.q || query.query || query.search);
    const orderNumber = normalize(query.orderNumber || q);
    const razorpayOrderId = normalize(query.razorpayOrderId || (q.startsWith('order_') ? q : ''));
    const razorpayPaymentId = normalize(query.razorpayPaymentId || (q.startsWith('pay_') ? q : ''));
    const requestId = normalize(query.requestId || (q.length >= 24 && !q.startsWith('order_') && !q.startsWith('pay_') ? q : ''));
    const contact = normalize(query.contact || '');
    const email = normalizeEmail(query.email || (q.includes('@') ? q : contact.includes('@') ? contact : ''));
    const phone = digitsOnly(query.phone || (!q.includes('@') ? q : '') || (!contact.includes('@') ? contact : ''));
    const objectId = isObjectId(q) ? q : '';

    return {
      q,
      orderNumber,
      razorpayOrderId,
      razorpayPaymentId,
      requestId,
      email,
      phone,
      objectId,
      hasInput: Boolean(q || query.orderNumber || query.razorpayOrderId || query.razorpayPaymentId || query.requestId || query.email || query.phone || query.contact),
    };
  }

  async findOrders(search) {
    const or = [];
    if (search.orderNumber) or.push({ orderNumber: search.orderNumber });
    if (search.objectId) or.push({ _id: search.objectId });
    if (search.email) or.push({ 'guestInfo.email': search.email });
    if (search.phone) {
      or.push({ 'guestInfo.phone': search.phone });
      or.push({ 'shippingAddress.phone': search.phone });
    }

    if (or.length === 0) return [];

    return this.OrderModel.find({ $or: or })
      .populate('user', 'name email phone role')
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findPayments(search, orderIds = []) {
    const or = [];
    if (search.razorpayOrderId) or.push({ razorpayOrderId: search.razorpayOrderId });
    if (search.razorpayPaymentId) or.push({ razorpayPaymentId: search.razorpayPaymentId });
    if (search.objectId) or.push({ _id: search.objectId });
    if (orderIds.length > 0) or.push({ order: { $in: orderIds } });

    if (or.length === 0) return [];

    return this.PaymentModel.find({ $or: or })
      .populate('user', 'name email phone role')
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findRelatedOrders(payments = [], existingOrderIds = []) {
    const orderIds = uniqueIds([...existingOrderIds, ...payments.map((payment) => payment.order)]);
    if (orderIds.length === 0) return [];

    return this.OrderModel.find({ _id: { $in: orderIds } })
      .populate('user', 'name email phone role')
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findRefunds(orderIds = [], paymentIds = [], search = {}) {
    const or = [];
    if (orderIds.length > 0) or.push({ order: { $in: orderIds } });
    if (paymentIds.length > 0) or.push({ payment: { $in: paymentIds } });
    if (search.q) or.push({ razorpayRefundId: search.q });
    if (or.length === 0) return [];

    return this.RefundModel.find({ $or: or })
      .populate('user', 'name email phone role')
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findWebhookEvents(search, payments = []) {
    const razorpayOrderIds = uniqueIds([
      search.razorpayOrderId,
      ...payments.map((payment) => payment.razorpayOrderId),
    ]);
    const razorpayPaymentIds = uniqueIds([
      search.razorpayPaymentId,
      ...payments.map((payment) => payment.razorpayPaymentId),
    ]);
    const or = [];
    if (search.q) or.push({ eventId: search.q });
    if (razorpayOrderIds.length > 0) or.push({ razorpayOrderId: { $in: razorpayOrderIds } });
    if (razorpayPaymentIds.length > 0) or.push({ razorpayPaymentId: { $in: razorpayPaymentIds } });
    if (or.length === 0) return [];

    return this.WebhookEventModel.find({ $or: or })
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findAlerts({ orderIds, orderNumbers, paymentIds, razorpayOrderIds, razorpayPaymentIds }) {
    const or = [];
    orderIds.forEach((value) => or.push({ 'metadata.orderId': value }));
    orderNumbers.forEach((value) => or.push({ 'metadata.orderNumber': value }));
    paymentIds.forEach((value) => or.push({ 'metadata.paymentId': value }));
    razorpayOrderIds.forEach((value) => or.push({ 'metadata.razorpayOrderId': value }));
    razorpayPaymentIds.forEach((value) => or.push({ 'metadata.razorpayPaymentId': value }));
    if (or.length === 0) return [];

    return this.AlertModel.find({ $or: or })
      .sort({ lastSeenAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findApplicationErrors(search) {
    if (!search.requestId) return [];
    return this.ErrorEventModel.find({ requestId: search.requestId })
      .sort({ lastSeenAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  async findAuditLogs(orderIds = [], refundIds = []) {
    const resourceIds = uniqueIds([...orderIds, ...refundIds]).filter(isObjectId);
    if (resourceIds.length === 0) return [];

    return this.AuditLogModel.find({ resourceId: { $in: resourceIds } })
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .limit(MAX_RESULTS)
      .lean();
  }

  buildTimeline({ orders, payments, refunds, webhookEvents, alerts, errors, audits }) {
    const timeline = [];

    orders.forEach((order) => {
      timeline.push({
        at: order.createdAt,
        type: 'order.created',
        severity: 'info',
        title: `Order ${order.orderNumber} created`,
        detail: `Payment ${order.paymentMethod || 'unknown'} / ${order.paymentStatus || 'pending'}`,
        data: { orderId: order._id, status: order.status, total: order.total },
      });
      (order.statusHistory || []).forEach((entry) => {
        timeline.push({
          at: entry.timestamp,
          type: 'order.status',
          severity: entry.status === 'cancelled' ? 'warning' : 'info',
          title: `Order status: ${entry.status}`,
          detail: entry.note || '',
          data: sanitizeValue(entry),
        });
      });
    });

    payments.forEach((payment) => {
      timeline.push({
        at: payment.createdAt,
        type: 'payment.created',
        severity: 'info',
        title: `Payment record created: ${payment.status}`,
        detail: payment.razorpayOrderId || String(payment._id),
        data: cleanPayment({ ...payment, webhookEvents: undefined }),
      });
      timeline.push({
        at: payment.updatedAt,
        type: 'payment.updated',
        severity: ['failed', 'expired'].includes(payment.status) ? 'warning' : 'info',
        title: `Payment status: ${payment.status}`,
        detail: payment.razorpayPaymentId || payment.razorpayOrderId || '',
        data: cleanPayment({ ...payment, webhookEvents: undefined }),
      });
      (payment.webhookEvents || []).slice(-MAX_EMBEDDED_WEBHOOK_EVENTS).forEach((event) => {
        timeline.push({
          at: event.receivedAt,
          type: 'payment.webhook_event',
          severity: event.event === 'payment.failed' ? 'warning' : 'info',
          title: event.event || 'Payment webhook event',
          detail: event.eventId || '',
          data: sanitizeValue(event),
        });
      });
    });

    webhookEvents.forEach((event) => {
      timeline.push({
        at: event.processedAt || event.updatedAt || event.createdAt,
        type: 'razorpay.webhook',
        severity: event.status === 'failed' ? 'critical' : 'info',
        title: `Razorpay webhook ${event.status}`,
        detail: `${event.eventType} / ${event.eventId}`,
        data: sanitizeValue({
          eventId: event.eventId,
          eventType: event.eventType,
          status: event.status,
          attempts: event.attempts,
          razorpayOrderId: event.razorpayOrderId,
          razorpayPaymentId: event.razorpayPaymentId,
          lastError: event.lastError,
          createdAt: event.createdAt,
          processedAt: event.processedAt,
        }),
      });
    });

    refunds.forEach((refund) => {
      timeline.push({
        at: refund.createdAt,
        type: 'refund.created',
        severity: refund.status === 'failed' ? 'critical' : 'info',
        title: `Refund ${refund.status}`,
        detail: refund.reason || refund.failureReason || '',
        data: sanitizeValue(refund),
      });
      (refund.events || []).forEach((event) => {
        timeline.push({
          at: event.at,
          type: 'refund.event',
          severity: event.status === 'failed' ? 'critical' : 'info',
          title: `Refund event: ${event.status}`,
          detail: event.note || '',
          data: sanitizeValue(event),
        });
      });
    });

    alerts.forEach((alert) => {
      timeline.push({
        at: alert.lastSeenAt || alert.updatedAt,
        type: 'operational.alert',
        severity: alert.severity,
        title: alert.type,
        detail: alert.message,
        data: sanitizeValue(alert),
      });
    });

    errors.forEach((error) => {
      timeline.push({
        at: error.lastSeenAt || error.updatedAt,
        type: 'application.error',
        severity: 'critical',
        title: error.message,
        detail: `${error.method || ''} ${error.path || ''}`.trim(),
        data: sanitizeValue(error),
      });
    });

    audits.forEach((audit) => {
      timeline.push({
        at: audit.createdAt,
        type: 'admin.audit',
        severity: audit.outcome === 'failure' ? 'warning' : 'info',
        title: audit.action,
        detail: `${audit.actorEmail || audit.actor?.email || 'admin'} ${audit.outcome}`,
        data: sanitizeValue(audit),
      });
    });

    return timeline
      .filter((item) => item.at)
      .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
      .slice(-MAX_TIMELINE_ITEMS);
  }

  buildSummary({ orders, payments, refunds, webhookEvents, alerts, errors }) {
    const issues = [];
    payments.forEach((payment) => {
      if (['failed', 'expired'].includes(payment.status)) issues.push(`Payment ${payment.status}`);
      if (payment.status === 'captured' && !orders.some((order) => String(order._id) === String(payment.order) && order.paymentStatus === 'paid')) {
        issues.push('Captured payment not reflected as paid order');
      }
    });
    refunds.forEach((refund) => {
      if (refund.status === 'failed') issues.push(`Refund failed: ${truncate(refund.failureReason || refund.reason || '', 160)}`);
    });
    webhookEvents.forEach((event) => {
      if (event.status === 'failed') issues.push(`Webhook failed: ${truncate(event.lastError || event.eventType, 160)}`);
    });
    alerts.forEach((alert) => {
      if (alert.severity === 'critical' && alert.status === 'open') issues.push(`Critical alert: ${alert.type}`);
    });
    if (errors.length > 0) issues.push(`${errors.length} application error event(s) for request`);

    return {
      health: issues.length > 0 ? 'needs_review' : 'clear',
      issues: [...new Set(issues)].slice(0, 10),
      counts: {
        orders: orders.length,
        payments: payments.length,
        refunds: refunds.length,
        webhookEvents: webhookEvents.length,
        alerts: alerts.length,
        applicationErrors: errors.length,
      },
    };
  }

  async trace(query = {}) {
    const search = this.buildSearch(query);
    if (!search.hasInput) {
      return {
        search,
        summary: this.buildSummary({ orders: [], payments: [], refunds: [], webhookEvents: [], alerts: [], errors: [] }),
        orders: [],
        payments: [],
        refunds: [],
        webhookEvents: [],
        alerts: [],
        applicationErrors: [],
        auditLogs: [],
        timeline: [],
      };
    }

    const initialOrders = await this.findOrders(search);
    const initialOrderIds = uniqueIds(initialOrders.map((order) => order._id));
    const payments = await this.findPayments(search, initialOrderIds);
    const orders = await this.findRelatedOrders(payments, initialOrderIds);
    const orderIds = uniqueIds(orders.map((order) => order._id));
    const orderNumbers = uniqueIds(orders.map((order) => order.orderNumber));
    const paymentIds = uniqueIds(payments.map((payment) => payment._id));
    const razorpayOrderIds = uniqueIds(payments.map((payment) => payment.razorpayOrderId).concat(search.razorpayOrderId));
    const razorpayPaymentIds = uniqueIds(payments.map((payment) => payment.razorpayPaymentId).concat(search.razorpayPaymentId));

    const [refunds, webhookEvents, alerts, errors] = await Promise.all([
      this.findRefunds(orderIds, paymentIds, search),
      this.findWebhookEvents(search, payments),
      this.findAlerts({ orderIds, orderNumbers, paymentIds, razorpayOrderIds, razorpayPaymentIds }),
      this.findApplicationErrors(search),
    ]);
    const refundIds = uniqueIds(refunds.map((refund) => refund._id));
    const audits = await this.findAuditLogs(orderIds, refundIds);
    const timeline = this.buildTimeline({ orders, payments, refunds, webhookEvents, alerts, errors, audits });

    return {
      search,
      summary: this.buildSummary({ orders, payments, refunds, webhookEvents, alerts, errors }),
      orders: orders.map((order) => sanitizeValue(order)),
      payments: payments.map(cleanPayment),
      refunds: refunds.map((refund) => sanitizeValue(refund)),
      webhookEvents: webhookEvents.map((event) => sanitizeValue({
        eventId: event.eventId,
        eventType: event.eventType,
        razorpayOrderId: event.razorpayOrderId,
        razorpayPaymentId: event.razorpayPaymentId,
        status: event.status,
        attempts: event.attempts,
        lastError: event.lastError,
        createdAt: event.createdAt,
        processedAt: event.processedAt,
        updatedAt: event.updatedAt,
      })),
      alerts: alerts.map((alert) => sanitizeValue(alert)),
      applicationErrors: errors.map((error) => sanitizeValue(error)),
      auditLogs: audits.map((audit) => sanitizeValue(audit)),
      timeline,
    };
  }
}

const service = new PaymentDiagnosticsService();

module.exports = service;
module.exports.PaymentDiagnosticsService = PaymentDiagnosticsService;
