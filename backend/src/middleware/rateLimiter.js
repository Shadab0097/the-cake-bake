const rateLimit = require('express-rate-limit');
const authSecurityService = require('../modules/auth/authSecurity.service');
const { createRateLimitStore } = require('./rateLimitStore');
const { env } = require('../config/env');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

// Login lockout window: full 15 minutes in production, but a short 30 seconds in
// development so local testing isn't blocked for 15 minutes after a few misses.
const LOGIN_WINDOW = env.isProd() ? FIFTEEN_MINUTES : 30 * 1000;
const LOGIN_WINDOW_LABEL = env.isProd() ? '15 minutes' : '30 seconds';

const createLimiter = (name, options) => {
  const store = createRateLimitStore(name);
  return rateLimit({
    ...options,
    ...(store && { store, passOnStoreError: false }),
  });
};

const matchesRoutePath = (req, pathName) => {
  const url = req.originalUrl || '';
  return url === pathName || url.startsWith(`${pathName}?`) || url.startsWith(`${pathName}/`);
};

const isWhatsAppWebhookPost = (req) => (
  req.method === 'POST' &&
  matchesRoutePath(req, '/api/v1/chatbot/webhook')
);

const isPaymentWebhookPost = (req) => (
  req.method === 'POST' &&
  matchesRoutePath(req, '/api/v1/payments/webhook')
);

const isHealthRoute = (req) => (
  req.method === 'GET' && (
    matchesRoutePath(req, '/api/v1/health') ||
    matchesRoutePath(req, '/api/v1/health/readiness')
  )
);

const apiLimiter = createLimiter('api', {
  windowMs: FIFTEEN_MINUTES,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isWhatsAppWebhookPost(req) || isPaymentWebhookPost(req) || isHealthRoute(req),
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes',
  },
});

const authLimiter = createLimiter('auth-general', {
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

const loginLimiter = createLimiter('auth-login', {
  windowMs: LOGIN_WINDOW,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: `Too many login attempts, please try again after ${LOGIN_WINDOW_LABEL}`,
  },
});

const registrationLimiter = createLimiter('auth-register', {
  windowMs: ONE_HOUR,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later',
  },
});

const passwordResetLimiter = createLimiter('auth-password-reset', {
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again after 15 minutes',
  },
});

const phoneVerificationLimiter = createLimiter('auth-phone-verification', {
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many phone verification attempts, please try again after 15 minutes',
  },
});

const adminLoginLimiter = createLimiter('auth-admin-login', {
  windowMs: LOGIN_WINDOW,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => !authSecurityService.isAdminLoginRequest(req.body),
  handler: async (req, res) => {
    await authSecurityService.recordAdminLoginRateLimited(req);
    return res.status(429).json({
      success: false,
      message: `Too many admin login attempts, please try again after ${LOGIN_WINDOW_LABEL}`,
    });
  },
});

const paymentLimiter = createLimiter('payments', {
  windowMs: ONE_MINUTE,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests, please slow down',
  },
});

const whatsappWebhookLimiter = createLimiter('webhook-whatsapp', {
  windowMs: ONE_MINUTE,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many webhook requests, please slow down',
  },
});

// Razorpay webhook: excluded from the global per-IP apiLimiter (signature-verified
// upstream). Keep a generous dedicated cap so a flood is still bounded without
// throttling legitimate provider bursts during payment peaks.
const razorpayWebhookLimiter = createLimiter('webhook-razorpay', {
  windowMs: ONE_MINUTE,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many webhook requests, please slow down',
  },
});

const searchLimiter = createLimiter('search', {
  windowMs: ONE_MINUTE,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many search requests, please slow down',
  },
});

// Reverse-geocoding hits a metered third-party (LocationIQ) free-tier quota.
// Cap per-IP bursts so a misbehaving client can't drain the daily allowance;
// server-side caching absorbs legitimate repeat lookups.
const geocodeLimiter = createLimiter('geocode', {
  windowMs: ONE_MINUTE,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many location requests, please try again shortly',
  },
});

const inquiryLimiter = createLimiter('inquiries', {
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions, please try again later',
  },
});

const orderLimiter = createLimiter('orders', {
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many order attempts, please try again later',
  },
});

const couponLimiter = createLimiter('coupons', {
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many coupon attempts, please try again later',
  },
});

// Public guest "Track Order" lookup (order number + email). Only failed
// attempts are counted (skipSuccessfulRequests), so legitimate guests are
// never blocked while brute-force enumeration of order numbers/emails is
// throttled hard per IP.
const trackOrderLimiter = createLimiter('track-order', {
  windowMs: FIFTEEN_MINUTES,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many tracking attempts, please try again after 15 minutes',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  loginLimiter,
  registrationLimiter,
  passwordResetLimiter,
  phoneVerificationLimiter,
  adminLoginLimiter,
  paymentLimiter,
  whatsappWebhookLimiter,
  razorpayWebhookLimiter,
  searchLimiter,
  geocodeLimiter,
  inquiryLimiter,
  orderLimiter,
  couponLimiter,
  trackOrderLimiter,
};
