const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { auth } = require('../../middleware/auth');

router.use(auth);

// Order retrieval and management
router.get('/', orderController.getOrders);
router.get('/:orderNumber', orderController.getOrder);
router.put('/:orderNumber/cancel', orderController.cancelOrder);

module.exports = router;
