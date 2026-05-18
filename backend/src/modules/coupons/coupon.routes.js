const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const validate = require('../../middleware/validate');
const couponValidation = require('./coupon.validation');
const { auth } = require('../../middleware/auth');
const { couponLimiter } = require('../../middleware/rateLimiter');

router.post('/validate', auth, couponLimiter, validate(couponValidation.validateCoupon), couponController.validateCoupon);

module.exports = router;
