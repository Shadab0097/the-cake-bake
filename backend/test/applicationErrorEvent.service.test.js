const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ApplicationErrorEventService,
  sanitizeValue,
} = require('../src/modules/monitoring/applicationErrorEvent.service');

const silentLogger = {
  warn: () => {},
  error: () => {},
  info: () => {},
};

test('application error sanitizer redacts secrets and caps payload size', () => {
  const sanitized = sanitizeValue({
    email: 'customer@example.com',
    password: 'plain-text',
    nested: {
      authorization: 'Bearer token',
      items: Array.from({ length: 30 }, (_, index) => ({ index })),
    },
  });

  assert.equal(sanitized.email, 'customer@example.com');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.nested.authorization, '[REDACTED]');
  assert.equal(sanitized.nested.items.length, 21);
  assert.match(sanitized.nested.items.at(-1), /more item/);
});

test('application error events throttle repeated fingerprints and aggregate suppressed occurrences', async () => {
  const calls = [];
  const fakeModel = {
    findOneAndUpdate: async (...args) => {
      calls.push(args);
      return { _id: 'event-id' };
    },
  };

  const service = new ApplicationErrorEventService({
    EventModel: fakeModel,
    logger: silentLogger,
    config: {
      applicationErrorEventsEnabled: true,
      applicationErrorRetentionDays: 7,
      applicationErrorMinWriteIntervalSeconds: 60,
    },
  });

  const error = new Error('Checkout failed');
  error.name = 'CheckoutError';
  const req = {
    id: 'req-123',
    method: 'POST',
    originalUrl: '/api/v1/orders',
    route: { path: '/orders' },
    headers: { 'user-agent': 'node-test' },
    params: { id: 'order-id' },
    query: { debug: 'true' },
    body: { token: 'secret', safe: 'value' },
    user: { _id: '507f191e810c19729de860ea', email: 'Admin@Example.com' },
    ip: '127.0.0.1',
  };

  await service.recordFromError(error, req, 500);
  await service.recordFromError(error, req, 500);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].$inc.occurrenceCount, 1);
  assert.equal(calls[0][1].$set.context.body.token, '[REDACTED]');
  assert.equal(calls[0][1].$set.context.body.safe, 'value');
  assert.equal(calls[0][1].$set.userEmail, 'admin@example.com');

  const fingerprint = calls[0][0].fingerprint;
  service.throttle.get(fingerprint).lastWriteAt = Date.now() - 61_000;

  await service.recordFromError(error, req, 500);

  assert.equal(calls.length, 2);
  assert.equal(calls[1][1].$inc.occurrenceCount, 2);
  assert.ok(calls[1][1].$set.expiresAt instanceof Date);
});

test('application error events ignore non-server errors and disabled mode', async () => {
  const fakeModel = {
    findOneAndUpdate: async () => {
      throw new Error('should not write');
    },
  };

  const service = new ApplicationErrorEventService({
    EventModel: fakeModel,
    logger: silentLogger,
    config: {
      applicationErrorEventsEnabled: false,
      applicationErrorRetentionDays: 7,
      applicationErrorMinWriteIntervalSeconds: 60,
    },
  });

  const result = await service.recordFromError(new Error('Bad request'), { method: 'GET' }, 500);
  assert.equal(result, null);

  service.config.applicationErrorEventsEnabled = true;
  const ignored = await service.recordFromError(new Error('Validation failed'), { method: 'GET' }, 400);
  assert.equal(ignored, null);
});
