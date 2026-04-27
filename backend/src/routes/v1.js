const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { searchLimiter, inquiryLimiter, orderLimiter } = require('../middleware/rateLimiter');

// Checkout router (create order + validate) — separate from order retrieval
const checkoutRouter = require('../modules/orders/checkout.routes');
// Guest checkout router (no auth required) — COD only
const guestCheckoutRouter = require('../modules/orders/guest.checkout.routes');
// Orders router (list, detail, cancel) — user-facing
const orderRouter = require('../modules/orders/order.routes');

// Mount all module routes
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/users/user.routes'));
router.use('/products', require('../modules/products/product.routes'));
router.use('/categories', require('../modules/categories/category.routes'));
router.use('/cart', require('../modules/cart/cart.routes'));
router.use('/checkout', orderLimiter, checkoutRouter);               // Rate limit order creation
router.use('/guest-checkout', orderLimiter, guestCheckoutRouter);     // Guest COD orders (no auth)
router.use('/orders', orderRouter);
router.use('/payments', require('../modules/payments/payment.routes'));
router.use('/coupons', require('../modules/coupons/coupon.routes'));
router.use('/delivery', require('../modules/delivery/delivery.routes'));
router.use('/addons', require('../modules/addons/addon.routes'));
router.use('/wishlist', require('../modules/wishlist/wishlist.routes'));
router.use('/reviews', require('../modules/reviews/review.routes'));
router.use('/inquiries', inquiryLimiter, require('../modules/inquiries/inquiry.routes'));  // Spam protection
router.use('/notifications', require('../modules/notifications/notification.routes'));
router.use('/reminders', require('../modules/reminders/reminder.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
// WhatsApp chatbot webhook — public, no auth (called by Meta Cloud API)
router.use('/chatbot', require('../modules/chatbot/chatbot.routes'));

// Enhanced health check — verifies DB connectivity
router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const isHealthy = dbState === 1;

  const healthData = {
    success: isHealthy,
    message: isHealthy ? 'The Cake Bake API is running' : 'Service degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    database: dbStates[dbState] || 'unknown',
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    },
    pid: process.pid,
  };

  res.status(isHealthy ? 200 : 503).json(healthData);
});

module.exports = router;
