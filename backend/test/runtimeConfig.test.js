const test = require('node:test');
const assert = require('node:assert/strict');

const { validateEnv } = require('../src/config/env');

const withEnv = (overrides, fn) => {
  const originalEnv = { ...process.env };

  try {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }

    Object.assign(process.env, {
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://localhost:27017/test',
      JWT_SECRET: 'jwt-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      RAZORPAY_KEY_ID: 'rzp_test',
      RAZORPAY_KEY_SECRET: 'razorpay-secret',
      ...overrides,
    });

    fn();
  } finally {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }
};

const productionSafeEnv = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://localhost:6379',
  JOB_QUEUE_MODE: 'bullmq',
  CORS_ORIGIN: 'https://thecakebake.in',
  APP_URL: 'https://thecakebake.in',
  JWT_SECRET: 'prod-access-token-signing-key-64chars-a1b2c3d4e5f6',
  JWT_REFRESH_SECRET: 'prod-refresh-token-signing-key-64chars-f6e5d4c3b2a1',
  RAZORPAY_KEY_ID: 'rzp_live_testkey',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  WHATSAPP_APP_SECRET: 'meta-secret',
  HEALTH_CHECK_TOKEN: 'health-token-32-characters-min',
  CLOUDINARY_CLOUD_NAME: 'cakebake',
  CLOUDINARY_API_KEY: 'cloudinary-key',
  CLOUDINARY_API_SECRET: 'cloudinary-secret',
};

test('runtime configuration accepts the default all-in-one development role', () => {
  withEnv({}, () => {
    assert.doesNotThrow(() => validateEnv());
  });
});

test('runtime configuration rejects unknown process roles', () => {
  withEnv({ PROCESS_ROLE: 'sidecar' }, () => {
    assert.throws(
      () => validateEnv(),
      /Invalid PROCESS_ROLE/
    );
  });
});

test('dedicated worker role cannot be started with job workers disabled', () => {
  withEnv({ PROCESS_ROLE: 'worker', ENABLE_JOB_WORKER: 'false' }, () => {
    assert.throws(
      () => validateEnv(),
      /PROCESS_ROLE=worker requires ENABLE_JOB_WORKER=true/
    );
  });
});

test('runtime configuration rejects invalid queue modes', () => {
  withEnv({ JOB_QUEUE_MODE: 'filesystem' }, () => {
    assert.throws(
      () => validateEnv(),
      /Invalid JOB_QUEUE_MODE/
    );
  });
});

test('production runtime requires BullMQ queue mode when explicitly set', () => {
  withEnv({
    ...productionSafeEnv,
    PROCESS_ROLE: 'web',
    JOB_QUEUE_MODE: 'inline',
  }, () => {
    assert.throws(
      () => validateEnv(),
      /NODE_ENV=production requires JOB_QUEUE_MODE=bullmq/
    );
  });
});

test('production runtime accepts safe web configuration', () => {
  withEnv({
    ...productionSafeEnv,
    PROCESS_ROLE: 'web',
  }, () => {
    assert.doesNotThrow(() => validateEnv());
  });
});

test('production runtime rejects default secrets and localhost origins', () => {
  withEnv({
    ...productionSafeEnv,
    JWT_SECRET: 'cakebake-jwt-secret-change-in-production',
    CORS_ORIGIN: 'http://localhost:3000',
  }, () => {
    assert.throws(
      () => validateEnv(),
      /Production configuration is not safe/
    );
  });
});
