const express = require('express');
const router = express.Router();
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const guestTrackingService = require('./guestTracking.service');

router.get(
  '/:orderNumber',
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || '').trim();
    if (!token) throw ApiError.forbidden('Guest tracking token is required');

    const order = await guestTrackingService.getGuestOrder(req.params.orderNumber, token);
    ApiResponse.ok(order).send(res);
  })
);

module.exports = router;
