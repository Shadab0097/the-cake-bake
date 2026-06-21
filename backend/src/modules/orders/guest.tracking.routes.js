const express = require('express');
const router = express.Router();
const Joi = require('joi');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const validate = require('../../middleware/validate');
const { orderLimiter, trackOrderLimiter } = require('../../middleware/rateLimiter');
const guestTrackingService = require('./guestTracking.service');

// Public guest lookup by order number + email (Track Order page).
// Strict, failure-counting rate limit guards against enumeration.
const lookupSchema = {
  body: Joi.object({
    orderNumber: Joi.string().trim().max(40).required().messages({
      'string.empty': 'Order number is required',
      'any.required': 'Order number is required',
    }),
    email: Joi.string().email().lowercase().trim().max(254).required().messages({
      'string.email': 'Please enter a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required',
    }),
  }),
};

router.post(
  '/lookup',
  trackOrderLimiter,
  validate(lookupSchema),
  asyncHandler(async (req, res) => {
    const { orderNumber, email } = req.body;
    const order = await guestTrackingService.lookupGuestOrderByEmail(orderNumber, email);
    ApiResponse.ok(order).send(res);
  })
);

// Signed-link guest tracking (token issued at checkout / in email).
router.get(
  '/:orderNumber',
  orderLimiter,
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || '').trim();
    if (!token) throw ApiError.forbidden('Guest tracking token is required');

    const order = await guestTrackingService.getGuestOrder(req.params.orderNumber, token);
    ApiResponse.ok(order).send(res);
  })
);

module.exports = router;
