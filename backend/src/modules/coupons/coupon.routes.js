const express = require('express');
const router = express.Router();
const couponController = require('./coupon.controller');
const validate = require('../../middleware/validate');
const couponValidation = require('./coupon.validation');
const { auth } = require('../../middleware/auth');

router.post('/validate', auth, validate(couponValidation.validateCoupon), couponController.validateCoupon);

module.exports = router;
