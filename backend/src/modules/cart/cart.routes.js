const express = require('express');
const router = express.Router();
const cartController = require('./cart.controller');
const validate = require('../../middleware/validate');
const cartValidation = require('./cart.validation');
const { auth } = require('../../middleware/auth');

router.use(auth);

router.get('/', cartController.getCart);
router.post('/items', validate(cartValidation.addItem), cartController.addItem);
router.put('/items/:itemId', validate(cartValidation.updateItem), cartController.updateItem);
router.delete('/items/:itemId', cartController.removeItem);
router.post('/coupon', validate(cartValidation.applyCoupon), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);
router.delete('/', cartController.clearCart);

module.exports = router;
