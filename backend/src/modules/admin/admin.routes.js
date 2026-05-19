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
const adminAuditService = require('./adminAudit.service');

// All admin routes require auth + admin role
router.use(auth, adminAuth);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/operational-alerts', adminController.getOperationalAlerts);
router.get('/refunds', adminController.getRefunds);
router.put('/refunds/:id/approve', validate(adminValidation.paramId), adminAuditService.audit('refund.approve', { resourceType: 'refund' }), adminController.approveRefund);
router.put('/refunds/:id/process', validate(adminValidation.paramId), adminAuditService.audit('refund.process', { resourceType: 'refund' }), adminController.processRefund);
router.put('/refunds/:id/fail', validate(adminValidation.paramId), adminAuditService.audit('refund.fail', { resourceType: 'refund' }), adminController.failRefund);

// Products
router.get('/products', adminController.listProducts);
router.post('/products', validate(productValidation.createProduct), adminAuditService.audit('product.create', { resourceType: 'product' }), adminController.createProduct);
router.post('/products/bulk-import', validate(adminValidation.bulkImportProducts), adminAuditService.audit('product.bulk_import', { resourceType: 'product' }), adminController.bulkImportProducts);
router.put('/products/:id', validate(productValidation.updateProduct), adminAuditService.audit('product.update', { resourceType: 'product' }), adminController.updateProduct);
router.delete('/products/:id', validate(adminValidation.paramId), adminAuditService.audit('product.delete', { resourceType: 'product' }), adminController.deleteProduct);
router.post('/products/:id/variants', validate(adminValidation.paramId), adminAuditService.audit('product.variant.create', { resourceType: 'variant', parentResourceIdParam: 'id' }), adminController.addVariant);
router.put('/products/:id/variants/:vid', adminAuditService.audit('product.variant.update', { resourceType: 'variant', resourceIdParam: 'vid', parentResourceIdParam: 'id' }), adminController.updateVariant);

// Categories
router.get('/categories', adminController.listCategories);
router.post('/categories', validate(categoryValidation.createCategory), adminAuditService.audit('category.create', { resourceType: 'category' }), adminController.createCategory);
router.put('/categories/:id', validate(adminValidation.updateCategory), adminAuditService.audit('category.update', { resourceType: 'category' }), adminController.updateCategory);
router.delete('/categories/:id', validate(adminValidation.paramId), adminAuditService.audit('category.delete', { resourceType: 'category' }), adminController.deleteCategory);

// Orders
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', validate(adminValidation.paramId), adminController.getOrderDetail);
router.put('/orders/:id/status', validate(adminValidation.updateOrderStatus), adminAuditService.audit('order.status.update', { resourceType: 'order' }), adminController.updateOrderStatus);

// Coupons
router.get('/coupons', adminController.listCoupons);
router.post('/coupons', validate(couponValidation.createCoupon), adminAuditService.audit('coupon.create', { resourceType: 'coupon' }), adminController.createCoupon);
router.put('/coupons/:id', validate(adminValidation.updateCoupon), adminAuditService.audit('coupon.update', { resourceType: 'coupon' }), adminController.updateCoupon);
router.delete('/coupons/:id', validate(adminValidation.paramId), adminAuditService.audit('coupon.delete', { resourceType: 'coupon' }), adminController.deleteCoupon);

// Delivery
router.get('/delivery/slots', adminController.getSlots);
router.post('/delivery/slots', validate(deliveryValidation.createSlot), adminAuditService.audit('delivery_slot.create', { resourceType: 'delivery_slot' }), adminController.createSlot);
router.put('/delivery/slots/:id', validate(adminValidation.paramId), adminAuditService.audit('delivery_slot.update', { resourceType: 'delivery_slot' }), adminController.updateSlot);
router.get('/delivery/zones', adminController.getZones);
router.post('/delivery/zones', validate(deliveryValidation.createZone), adminAuditService.audit('delivery_zone.create', { resourceType: 'delivery_zone' }), adminController.createZone);
router.put('/delivery/zones/:id', validate(adminValidation.paramId), adminAuditService.audit('delivery_zone.update', { resourceType: 'delivery_zone' }), adminController.updateZone);

// Add-Ons
router.get('/addons', adminController.listAddOns);
router.post('/addons', validate(addonValidation.createAddOn), adminAuditService.audit('addon.create', { resourceType: 'addon' }), adminController.createAddOn);
router.put('/addons/:id', validate(adminValidation.updateAddOn), adminAuditService.audit('addon.update', { resourceType: 'addon' }), adminController.updateAddOn);
router.delete('/addons/:id', validate(adminValidation.paramId), adminAuditService.audit('addon.delete', { resourceType: 'addon' }), adminController.deleteAddOn);

// Inquiries
router.get('/inquiries/custom', adminController.getCustomInquiries);
router.get('/inquiries/corporate', adminController.getCorporateInquiries);
router.put('/inquiries/:id', validate(adminValidation.updateInquiry), adminAuditService.audit('inquiry.update', { resourceType: 'inquiry' }), adminController.updateInquiry);

// Customers
router.get('/customers', adminController.getCustomers);
router.get('/customers/:id', validate(adminValidation.paramId), adminController.getCustomerDetail);
router.put('/customers/:id/points', validate(adminValidation.adjustPoints), adminAuditService.audit('customer.points.adjust', { resourceType: 'customer' }), adminController.adjustCustomerPoints);

// Reviews
router.get('/reviews', adminController.getReviews);
router.put('/reviews/:id/approve', validate(adminValidation.paramId), adminAuditService.audit('review.approve', { resourceType: 'review' }), adminController.approveReview);
router.delete('/reviews/:id', validate(adminValidation.paramId), adminAuditService.audit('review.delete', { resourceType: 'review' }), adminController.deleteReview);

// Banners
router.get('/banners', adminController.getBanners);
router.post('/banners', validate(adminValidation.createBanner), adminAuditService.audit('banner.create', { resourceType: 'banner' }), adminController.createBanner);
router.put('/banners/:id', validate(adminValidation.updateBanner), adminAuditService.audit('banner.update', { resourceType: 'banner' }), adminController.updateBanner);
router.delete('/banners/:id', validate(adminValidation.paramId), adminAuditService.audit('banner.delete', { resourceType: 'banner' }), adminController.deleteBanner);

// Notifications
router.get('/notifications', adminController.getNotifications);
router.post('/notifications/send', validate(adminValidation.sendNotification), adminAuditService.audit('notification.manual_send', { resourceType: 'notification' }), adminController.sendManualNotification);

// Chatbot — Bot Rules & Logs
router.get('/chatbot/stats', adminController.getChatbotStats);
router.get('/chatbot/rules', adminController.listBotRules);
router.post('/chatbot/rules', validate(adminValidation.createBotRule), adminAuditService.audit('chatbot_rule.create', { resourceType: 'chatbot_rule' }), adminController.createBotRule);
router.put('/chatbot/rules/:id', validate(adminValidation.updateBotRule), adminAuditService.audit('chatbot_rule.update', { resourceType: 'chatbot_rule' }), adminController.updateBotRule);
router.delete('/chatbot/rules/:id', validate(adminValidation.paramId), adminAuditService.audit('chatbot_rule.delete', { resourceType: 'chatbot_rule' }), adminController.deleteBotRule);
router.get('/chatbot/logs', adminController.getChatbotLogs);

module.exports = router;
