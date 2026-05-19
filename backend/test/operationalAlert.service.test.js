const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperationalAlertService,
  sanitizeMetadata,
} = require('../src/modules/monitoring/operationalAlert.service');

const silentLogger = {
  error() {},
  info() {},
  warn() {},
};

test('operational alert metadata sanitizer redacts secrets and limits large payloads', () => {
  const sanitized = sanitizeMetadata({
    authorization: 'Bearer secret',
    razorpaySignature: 'signature',
    nested: {
      refreshToken: 'refresh',
      safe: 'ok',
    },
    longText: 'x'.repeat(1200),
  });

  assert.equal(sanitized.authorization, '[REDACTED]');
  assert.equal(sanitized.razorpaySignature, '[REDACTED]');
  assert.equal(sanitized.nested.refreshToken, '[REDACTED]');
  assert.equal(sanitized.nested.safe, 'ok');
  assert.equal(sanitized.longText.length, 1003);
});

test('recordAlert persists a deduped alert and skips webhook when not configured', async () => {
  const updates = [];
  const service = new OperationalAlertService({
    logger: silentLogger,
    config: {
      alertWebhookUrl: '',
      alertWebhookToken: '',
      alertCooldownMinutes: 15,
      alertWebhookTimeoutMs: 3000,
    },
    AlertModel: {
      findOneAndUpdate: async (filter, update, options) => {
        updates.push({ filter, update, options });
        return {
          _id: 'alert-id',
          ...update.$setOnInsert,
          ...update.$set,
          dedupeKey: filter.dedupeKey,
          occurrenceCount: 2,
        };
      },
      updateOne: async () => {
        throw new Error('webhook should be skipped');
      },
    },
  });

  const alert = await service.recordAlert({
    type: 'payment_order_mismatch',
    severity: 'critical',
    source: 'payment.test',
    message: 'Mismatch',
    dedupeKey: 'payment:test',
    metadata: { token: 'secret', safe: true },
  });

  assert.equal(alert.dedupeKey, 'payment:test');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].filter.dedupeKey, 'payment:test');
  assert.equal(updates[0].update.$set.metadata.token, '[REDACTED]');
  assert.equal(updates[0].update.$inc.occurrenceCount, 1);
  assert.equal(updates[0].options.upsert, true);
});

test('webhook notification honors cooldown and sends bearer token when due', async () => {
  const posts = [];
  const updates = [];
  const service = new OperationalAlertService({
    logger: silentLogger,
    config: {
      alertWebhookUrl: 'https://alerts.example.test/hook',
      alertWebhookToken: 'alert-token',
      alertCooldownMinutes: 15,
      alertWebhookTimeoutMs: 2500,
    },
    httpClient: {
      post: async (...args) => {
        posts.push(args);
      },
    },
    AlertModel: {
      updateOne: async (...args) => {
        updates.push(args);
      },
    },
  });

  const cooledDown = await service.notifyWebhook({
    _id: 'alert-id',
    type: 'api_5xx_error',
    severity: 'critical',
    source: 'api',
    message: 'failed',
    dedupeKey: 'api:test',
    metadata: {},
    occurrenceCount: 1,
    lastSeenAt: new Date(),
    notifiedAt: new Date(),
  });
  assert.equal(cooledDown.sent, false);
  assert.equal(posts.length, 0);

  const due = await service.notifyWebhook({
    _id: 'alert-id',
    type: 'api_5xx_error',
    severity: 'critical',
    source: 'api',
    message: 'failed',
    dedupeKey: 'api:test',
    metadata: {},
    occurrenceCount: 1,
    lastSeenAt: new Date(),
    notifiedAt: new Date(Date.now() - 16 * 60 * 1000),
  });

  assert.equal(due.sent, true);
  assert.equal(posts.length, 1);
  assert.equal(posts[0][0], 'https://alerts.example.test/hook');
  assert.equal(posts[0][2].timeout, 2500);
  assert.equal(posts[0][2].headers.Authorization, 'Bearer alert-token');
  assert.equal(updates.length, 1);
});

test('recordPaymentMismatch builds a critical deduped alert with order and payment context', async () => {
  let persistedFilter = null;
  let persistedUpdate = null;
  const service = new OperationalAlertService({
    logger: silentLogger,
    config: {
      alertWebhookUrl: '',
      alertWebhookToken: '',
      alertCooldownMinutes: 15,
      alertWebhookTimeoutMs: 3000,
    },
    AlertModel: {
      findOneAndUpdate: async (filter, update) => {
        persistedFilter = filter;
        persistedUpdate = update;
        return {
          _id: 'alert-id',
          ...update.$setOnInsert,
          ...update.$set,
          dedupeKey: filter.dedupeKey,
        };
      },
    },
  });

  await service.recordPaymentMismatch({
    order: {
      _id: 'order-id',
      orderNumber: 'TCB-3001',
      status: 'cancelled',
      paymentStatus: 'expired',
    },
    payment: {
      _id: 'payment-id',
      razorpayOrderId: 'order_rzp',
      razorpayPaymentId: 'pay_rzp',
      status: 'captured',
    },
    reason: 'Captured payment cannot be finalized',
    source: 'payment.finalization',
    metadata: { razorpayKeySecret: 'secret' },
  });

  assert.equal(persistedUpdate.$setOnInsert.type, 'payment_order_mismatch');
  assert.equal(persistedUpdate.$setOnInsert.severity, 'critical');
  assert.equal(persistedFilter.dedupeKey, 'payment_order_mismatch:order-id:payment-id:Captured payment cannot be finalized');
  assert.equal(persistedUpdate.$set.metadata.orderNumber, 'TCB-3001');
  assert.equal(persistedUpdate.$set.metadata.paymentStatus, 'captured');
  assert.equal(persistedUpdate.$set.metadata.razorpayKeySecret, '[REDACTED]');
});
