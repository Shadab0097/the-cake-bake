const test = require('node:test');
const assert = require('node:assert/strict');

const { PaymentDiagnosticsService } = require('../src/modules/payments/paymentDiagnostics.service');

test('payment diagnostics returns empty read-only trace without search input', async () => {
  const service = new PaymentDiagnosticsService();
  const result = await service.trace({});

  assert.equal(result.summary.health, 'clear');
  assert.deepEqual(result.timeline, []);
  assert.equal(result.orders.length, 0);
  assert.equal(result.payments.length, 0);
});

test('payment diagnostics timeline highlights failed payments, webhooks, refunds, alerts, and errors', () => {
  const service = new PaymentDiagnosticsService();
  const now = new Date('2026-05-25T10:00:00.000Z');
  const order = {
    _id: '507f191e810c19729de860ea',
    orderNumber: 'CB-1001',
    paymentMethod: 'online',
    paymentStatus: 'pending',
    status: 'pending',
    total: 129900,
    createdAt: now,
    statusHistory: [{ status: 'pending', note: 'Created', timestamp: now }],
  };
  const payment = {
    _id: '507f191e810c19729de860eb',
    order: order._id,
    status: 'failed',
    razorpayOrderId: 'order_test',
    razorpayPaymentId: 'pay_test',
    createdAt: now,
    updatedAt: now,
    webhookEvents: [{ eventId: 'evt_1', event: 'payment.failed', receivedAt: now, payload: { token: 'secret' } }],
  };
  const refund = {
    _id: '507f191e810c19729de860ec',
    status: 'failed',
    failureReason: 'Provider rejected',
    createdAt: now,
    events: [{ status: 'failed', note: 'Provider rejected', at: now }],
  };
  const webhookEvent = {
    eventId: 'evt_1',
    eventType: 'payment.failed',
    status: 'failed',
    attempts: 2,
    lastError: 'Handler failed',
    createdAt: now,
  };
  const alert = {
    type: 'payment_order_mismatch',
    severity: 'critical',
    status: 'open',
    message: 'Mismatch',
    lastSeenAt: now,
  };
  const error = {
    message: 'Webhook crashed',
    method: 'POST',
    path: '/payments/webhook',
    lastSeenAt: now,
  };

  const timeline = service.buildTimeline({
    orders: [order],
    payments: [payment],
    refunds: [refund],
    webhookEvents: [webhookEvent],
    alerts: [alert],
    errors: [error],
    audits: [],
  });
  const summary = service.buildSummary({
    orders: [order],
    payments: [payment],
    refunds: [refund],
    webhookEvents: [webhookEvent],
    alerts: [alert],
    errors: [error],
  });

  assert.ok(timeline.some((item) => item.type === 'payment.webhook_event'));
  assert.equal(timeline.find((item) => item.type === 'payment.webhook_event').data.payload.token, '[REDACTED]');
  assert.equal(summary.health, 'needs_review');
  assert.ok(summary.issues.some((issue) => issue.includes('Payment failed')));
  assert.ok(summary.issues.some((issue) => issue.includes('Refund failed')));
  assert.ok(summary.issues.some((issue) => issue.includes('Webhook failed')));
  assert.ok(summary.issues.some((issue) => issue.includes('Critical alert')));
});
