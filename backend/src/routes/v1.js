const express = require('express');
const router = express.Router();
const { searchLimiter, inquiryLimiter, orderLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');
const healthService = require('../modules/health/health.service');

// Checkout router (create order + validate) — separate from order retrieval
const checkoutRouter = require('../modules/orders/checkout.routes');
// Guest checkout router (no auth required) — COD only
const guestCheckoutRouter = require('../modules/orders/guest.checkout.routes');
const guestTrackingRouter = require('../modules/orders/guest.tracking.routes');
// Orders router (list, detail, cancel) — user-facing
const orderRouter = require('../modules/orders/order.routes');

const requireReadinessAccess = (req, res, next) => {
  if (healthService.isReadinessTokenAuthorized(req)) {
    return next();
  }

  return auth(req, res, (authError) => {
    if (authError) return next(authError);
    return adminAuth(req, res, next);
  });
};

router.get('/health', (req, res) => {
  healthService.sendNoStore(res);
  const result = healthService.buildPublicHealth();
  res.status(result.statusCode).json(result.body);
});

router.get('/health/readiness', requireReadinessAccess, (req, res) => {
  healthService.sendNoStore(res);
  const result = healthService.buildReadinessHealth();
  res.status(result.statusCode).json(result.body);
});

// Mount all module routes
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/users', require('../modules/users/user.routes'));
router.use('/products', require('../modules/products/product.routes'));
router.use('/categories', require('../modules/categories/category.routes'));
router.use('/banners', require('../modules/banners/banner.routes'));
router.use('/cart', require('../modules/cart/cart.routes'));
router.use('/checkout', orderLimiter, checkoutRouter);               // Rate limit order creation
router.use('/guest-checkout', orderLimiter, guestCheckoutRouter);     // Guest COD orders (no auth)
router.use('/guest-orders', guestTrackingRouter);                     // Guest order tracking (per-route limits: token GET + email lookup)
router.use('/orders', orderRouter);
router.use('/payments', require('../modules/payments/payment.routes'));
router.use('/coupons', require('../modules/coupons/coupon.routes'));
router.use('/delivery', require('../modules/delivery/delivery.routes'));
router.use('/addons', require('../modules/addons/addon.routes'));
router.use('/uploads', require('../modules/media/upload.routes'));
router.use('/wishlist', require('../modules/wishlist/wishlist.routes'));
router.use('/reviews', require('../modules/reviews/review.routes'));
router.use('/inquiries', inquiryLimiter, require('../modules/inquiries/inquiry.routes'));  // Spam protection
router.use('/notifications', require('../modules/notifications/notification.routes'));
router.use('/reminders', require('../modules/reminders/reminder.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
// WhatsApp chatbot webhook — public, no auth (called by Meta Cloud API)
router.use('/chatbot', require('../modules/chatbot/chatbot.routes'));

module.exports = router;
