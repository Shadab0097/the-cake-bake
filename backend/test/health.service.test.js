const test = require('node:test');
const assert = require('node:assert/strict');

const healthService = require('../src/modules/health/health.service');

const completeEnv = {
  RAZORPAY_KEY_ID: 'rzp_test',
  RAZORPAY_KEY_SECRET: 'secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  ENABLE_EMAIL_NOTIFICATIONS: 'true',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-pass',
  SMTP_FROM_EMAIL: 'noreply@example.com',
  ENABLE_WHATSAPP_NOTIFICATIONS: 'true',
  WHATSAPP_ACCESS_TOKEN: 'whatsapp-token',
  WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
  WHATSAPP_VERIFY_TOKEN: 'verify-token',
  WHATSAPP_APP_SECRET: 'app-secret',
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'api-key',
  CLOUDINARY_API_SECRET: 'api-secret',
};

test('public health payload is minimal and does not leak operational details', () => {
  const result = healthService.buildPublicHealth();

  assert.equal(result.statusCode, 200);
  assert.deepEqual(Object.keys(result.body).sort(), ['status', 'success']);
  assert.equal(result.body.success, true);
  assert.equal(result.body.status, 'ok');

  for (const key of ['checks', 'memory', 'pid', 'environment', 'version', 'uptime', 'timestamp', 'message']) {
    assert.equal(Object.hasOwn(result.body, key), false);
  }
});

test('readiness health reports database and private config status without runtime internals', () => {
  const result = healthService.buildReadinessHealth({
    dbState: 1,
    envVars: completeEnv,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.checks.database.status, 'ok');
  assert.equal(result.body.checks.database.state, 'connected');
  assert.equal(result.body.checks.razorpay.status, 'ok');
  assert.equal(result.body.checks.smtp.status, 'ok');
  assert.equal(result.body.checks.whatsapp.status, 'ok');
  assert.equal(result.body.checks.cloudinary.status, 'ok');

  for (const key of ['memory', 'pid', 'environment', 'version', 'uptime']) {
    assert.equal(Object.hasOwn(result.body, key), false);
  }
});

test('readiness health degrades when database is unavailable and flags missing enabled providers', () => {
  const result = healthService.buildReadinessHealth({
    dbState: 0,
    envVars: {
      ...completeEnv,
      WHATSAPP_APP_SECRET: '',
      SMTP_PASS: '',
    },
  });

  assert.equal(result.statusCode, 503);
  assert.equal(result.body.success, false);
  assert.equal(result.body.status, 'degraded');
  assert.equal(result.body.checks.database.status, 'degraded');
  assert.equal(result.body.checks.database.state, 'disconnected');
  assert.equal(result.body.checks.smtp.status, 'misconfigured');
  assert.equal(result.body.checks.whatsapp.status, 'misconfigured');
});

test('readiness health reports disabled providers without requiring credentials', () => {
  const result = healthService.buildReadinessHealth({
    dbState: 1,
    envVars: {
      ...completeEnv,
      ENABLE_EMAIL_NOTIFICATIONS: 'false',
      ENABLE_WHATSAPP_NOTIFICATIONS: 'false',
      SMTP_USER: '',
      SMTP_PASS: '',
      WHATSAPP_ACCESS_TOKEN: '',
      WHATSAPP_APP_SECRET: '',
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, 'ok');
  assert.equal(result.body.checks.smtp.status, 'disabled');
  assert.equal(result.body.checks.whatsapp.status, 'disabled');
});

test('readiness token guard authorizes only the configured internal token', () => {
  const req = {
    headers: {
      'x-health-check-token': 'internal-token',
    },
  };

  assert.equal(healthService.isReadinessTokenAuthorized(req, 'internal-token'), true);
  assert.equal(healthService.isReadinessTokenAuthorized(req, 'wrong-token'), false);
  assert.equal(healthService.isReadinessTokenAuthorized(req, ''), false);
  assert.equal(healthService.isReadinessTokenAuthorized({ headers: {} }, 'internal-token'), false);
});
