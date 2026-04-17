const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const validate = require('../../middleware/validate');
const orderValidation = require('./order.validation');
const { auth } = require('../../middleware/auth');

router.use(auth);

// Checkout: validate cart + create Razorpay order
router.post('/validate', validate(orderValidation.validateCheckout), orderController.validateCheckout);
router.post('/create-order', validate(orderValidation.createOrder), orderController.createOrder);

module.exports = router;
