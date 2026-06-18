const express = require('express');
const router = express.Router();
const paymentController = require('./payment.controller');
const validate = require('../../middleware/validate');
const paymentValidation = require('./payment.validation');
const { auth } = require('../../middleware/auth');
const { paymentLimiter, razorpayWebhookLimiter } = require('../../middleware/rateLimiter');

router.post('/verify', auth, paymentLimiter, validate(paymentValidation.verifyPayment), paymentController.verifyPayment);

// Webhook — raw body needed for signature verification, no JWT auth.
// Excluded from the global apiLimiter (see rateLimiter.js); uses a dedicated
// high cap so Razorpay bursts are not throttled during payment peaks.
router.post('/webhook', razorpayWebhookLimiter, express.raw({ type: 'application/json' }), paymentController.handleWebhook);

module.exports = router;
