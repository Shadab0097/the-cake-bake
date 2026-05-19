'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

const { env } = require('../../config/env');

const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

const statusFromEnabledConfig = ({ enabled, requiredValues }) => {
  if (!enabled) return 'disabled';
  return requiredValues.every(Boolean) ? 'ok' : 'misconfigured';
};

const buildPublicHealth = () => ({
  statusCode: 200,
  body: {
    success: true,
    status: 'ok',
  },
});

const buildReadinessHealth = ({
  dbState = mongoose.connection.readyState,
  envVars = process.env,
} = {}) => {
  const isDbHealthy = dbState === 1;
  const checks = {
    database: {
      status: isDbHealthy ? 'ok' : 'degraded',
      state: DB_STATES[dbState] || 'unknown',
    },
    razorpay: {
      status: statusFromEnabledConfig({
        enabled: true,
        requiredValues: [envVars.RAZORPAY_KEY_ID, envVars.RAZORPAY_KEY_SECRET, envVars.RAZORPAY_WEBHOOK_SECRET],
      }),
    },
    smtp: {
      status: statusFromEnabledConfig({
        enabled: envVars.ENABLE_EMAIL_NOTIFICATIONS === 'true',
        requiredValues: [envVars.SMTP_USER, envVars.SMTP_PASS, envVars.SMTP_FROM_EMAIL],
      }),
    },
    whatsapp: {
      status: statusFromEnabledConfig({
        enabled: envVars.ENABLE_WHATSAPP_NOTIFICATIONS === 'true',
        requiredValues: [
          envVars.WHATSAPP_ACCESS_TOKEN,
          envVars.WHATSAPP_PHONE_NUMBER_ID,
          envVars.WHATSAPP_VERIFY_TOKEN,
          envVars.WHATSAPP_APP_SECRET,
        ],
      }),
    },
    cloudinary: {
      status: statusFromEnabledConfig({
        enabled: true,
        requiredValues: [
          envVars.CLOUDINARY_CLOUD_NAME,
          envVars.CLOUDINARY_API_KEY,
          envVars.CLOUDINARY_API_SECRET,
        ],
      }),
    },
    monitoring: {
      status: envVars.OPERATIONAL_ALERT_WEBHOOK_URL ? 'ok' : 'disabled',
    },
  };

  const hasWarnings = Object.values(checks).some((check) => check.status === 'misconfigured');

  return {
    statusCode: isDbHealthy ? 200 : 503,
    body: {
      success: isDbHealthy,
      status: isDbHealthy ? (hasWarnings ? 'warning' : 'ok') : 'degraded',
      checks,
    },
  };
};

const timingSafeEqual = (actual, expected) => {
  if (!actual || !expected || typeof actual !== 'string' || typeof expected !== 'string') {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const getHealthTokenFromRequest = (req) => {
  const token = req.get?.('x-health-check-token') || req.headers?.['x-health-check-token'];
  return Array.isArray(token) ? token[0] : token;
};

const isReadinessTokenAuthorized = (req, configuredToken = env.health.checkToken) => {
  const expected = typeof configuredToken === 'string' ? configuredToken.trim() : '';
  if (!expected) return false;

  const provided = getHealthTokenFromRequest(req);
  return timingSafeEqual(provided, expected);
};

const sendNoStore = (res) => {
  res.setHeader('Cache-Control', 'no-store');
};

module.exports = {
  buildPublicHealth,
  buildReadinessHealth,
  isReadinessTokenAuthorized,
  sendNoStore,
};
