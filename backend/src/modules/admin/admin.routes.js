const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const validate = require('../../middleware/validate');
const adminValidation = require('./admin.validation');
const productValidation = require('../products/product.validation');
const couponValidation = require('../coupons/coupon.validation');
const deliveryValidation = require('../delivery/delivery.validation');
const categoryValidation = require('../categories/category.validation');
const addonValidation = require('../addons/addon.validation');
const { auth } = require('../../middleware/auth');
const { adminAuth } = require('../../middleware/adminAuth');

// All admin routes require auth + admin role
router.use(auth, adminAuth);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);

// Products
router.get('/products', adminController.listProducts);
router.post('/products', validate(productValidation.createProduct), adminController.createProduct);
router.post('/products/bulk-import', validate(adminValidation.bulkImportProducts), adminController.bulkImportProducts);
router.put('/products/:id', validate(productValidation.updateProduct), adminController.updateProduct);
router.delete('/products/:id', validate(adminValidation.paramId), adminController.deleteProduct);
router.post('/products/:id/variants', validate(adminValidation.paramId), adminController.addVariant);
router.put('/products/:id/variants/:vid', adminController.updateVariant);

// Categories
router.get('/categories', adminController.listCategories);
router.post('/categories', validate(categoryValidation.createCategory), adminController.createCategory);
router.put('/categories/:id', validate(adminValidation.updateCategory), adminController.updateCategory);
router.delete('/categories/:id', validate(adminValidation.paramId), adminController.deleteCategory);

// Orders
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', validate(adminValidation.paramId), adminController.getOrderDetail);
router.put('/orders/:id/status', validate(adminValidation.updateOrderStatus), adminController.updateOrderStatus);

// Coupons
router.get('/coupons', adminController.listCoupons);
router.post('/coupons', validate(couponValidation.createCoupon), adminController.createCoupon);
router.put('/coupons/:id', validate(adminValidation.updateCoupon), adminController.updateCoupon);
router.delete('/coupons/:id', validate(adminValidation.paramId), adminController.deleteCoupon);

// Delivery
router.get('/delivery/slots', adminController.getSlots);
router.post('/delivery/slots', validate(deliveryValidation.createSlot), adminController.createSlot);
router.put('/delivery/slots/:id', validate(adminValidation.paramId), adminController.updateSlot);
router.get('/delivery/zones', adminController.getZones);
router.post('/delivery/zones', validate(deliveryValidation.createZone), adminController.createZone);
router.put('/delivery/zones/:id', validate(adminValidation.paramId), adminController.updateZone);

// Add-Ons
router.get('/addons', adminController.listAddOns);
router.post('/addons', validate(addonValidation.createAddOn), adminController.createAddOn);
router.put('/addons/:id', validate(adminValidation.updateAddOn), adminController.updateAddOn);
router.delete('/addons/:id', validate(adminValidation.paramId), adminController.deleteAddOn);

// Inquiries
router.get('/inquiries/custom', adminController.getCustomInquiries);
router.get('/inquiries/corporate', adminController.getCorporateInquiries);
router.put('/inquiries/:id', validate(adminValidation.updateInquiry), adminController.updateInquiry);

// Customers
router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', validate(adminValidation.paramId), adminController.getCustomerDetail);
router.put('/customers/:id/points', validate(adminValidation.adjustPoints), adminController.adjustCustomerPoints);

// Reviews
router.get('/reviews', adminController.getReviews);
router.put('/reviews/:id/approve', validate(adminValidation.paramId), adminController.approveReview);
router.delete('/reviews/:id', validate(adminValidation.paramId), adminController.deleteReview);

// Banners
router.get('/banners', adminController.getBanners);
router.post('/banners', validate(adminValidation.createBanner), adminController.createBanner);
router.put('/banners/:id', validate(adminValidation.updateBanner), adminController.updateBanner);
router.delete('/banners/:id', validate(adminValidation.paramId), adminController.deleteBanner);

// Notifications
router.get('/notifications', adminController.getNotifications);
router.post('/notifications/send', validate(adminValidation.sendNotification), adminController.sendManualNotification);

// Chatbot — Bot Rules & Logs
router.get('/chatbot/stats', adminController.getChatbotStats);
router.get('/chatbot/rules', adminController.listBotRules);
router.post('/chatbot/rules', validate(adminValidation.createBotRule), adminController.createBotRule);
router.put('/chatbot/rules/:id', validate(adminValidation.updateBotRule), adminController.updateBotRule);
router.delete('/chatbot/rules/:id', validate(adminValidation.paramId), adminController.deleteBotRule);
router.get('/chatbot/logs', adminController.getChatbotLogs);

module.exports = router;
