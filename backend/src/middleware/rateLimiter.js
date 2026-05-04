const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * 300 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes',
  },
});

/**
 * Stricter limiter for auth routes (login, register, forgot-password)
 * Prevents brute-force attacks — 20 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

/**
 * Limiter for payment routes
 * Prevents payment abuse — 10 per minute
 */
const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests, please slow down',
  },
});

/**
 * Limiter for search and listing endpoints
 * Prevents scraping — 60 requests per minute
 */
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many search requests, please slow down',
  },
});

/**
 * Limiter for inquiry/contact form submissions
 * Prevents spam — 5 submissions per 15 minutes
 */
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions, please try again later',
  },
});

/**
 * Limiter for order creation
 * Prevents bot abuse — 10 orders per 15 minutes
 */
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many order attempts, please try again later',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  paymentLimiter,
  searchLimiter,
  inquiryLimiter,
  orderLimiter,
};
