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
const { adminAuth, superAdminAuth } = require('../../middleware/adminAuth');
const ApiError = require('../../utils/ApiError');
const { sectionForPath, canAccess, BRANCHADMIN_SECTIONS } = require('../../utils/adminAccess');
const adminAuditService = require('./adminAudit.service');
const branchSelfController = require('./branchSelf.controller');
const branchSelfValidation = require('./branchSelf.validation');

// All admin routes require auth + admin-tier role.
router.use(auth, adminAuth);

// Identity endpoint — returns the caller's role, branch scope, and the branches
// they may act on (owner => all active; walled => only theirs). Registered
// BEFORE the section guard because it's identity, not a feature section, and the
// frontend needs it to render the (locked) branch picker for walled admins.
router.get('/me', adminController.getMe);

// ── Branch self-management (owner + branch admins only) ───────────────────
// Mounted BEFORE the coarse section guard and governed by its own role + scope
// checks: branch admins manage ONLY their own branch's settings and staff, and
// can never escalate a role or reach another branch. All data is scoped
// server-side via req.branchScope; the explicit role guard excludes
// managers/staff entirely (they have no business managing a branch or its team).
const branchSelfRouter = express.Router();
branchSelfRouter.use(require('../../middleware/branchScope'));
branchSelfRouter.use((req, res, next) => {
  const role = req.user.role;
  if (role === 'superadmin' || role === 'admin' || role === 'branchadmin') return next();
  return next(ApiError.forbidden('Branch self-management is limited to branch admins'));
});
branchSelfRouter.get('/', branchSelfController.getMyBranches);
branchSelfRouter.get('/staff', branchSelfController.listMyStaff);
branchSelfRouter.post('/staff', validate(branchSelfValidation.createMyStaff), adminAuditService.audit('branch.staff.create', { resourceType: 'user' }), branchSelfController.createMyStaff);
branchSelfRouter.put('/staff/:id/active', validate(branchSelfValidation.setMyStaffActive), adminAuditService.audit('branch.staff.active', { resourceType: 'user' }), branchSelfController.setMyStaffActive);
branchSelfRouter.put('/staff/:id/branches', validate(branchSelfValidation.setMyStaffBranches), adminAuditService.audit('branch.staff.branches', { resourceType: 'user' }), branchSelfController.setMyStaffBranches);
branchSelfRouter.post('/staff/:id/reset-password', validate(branchSelfValidation.staffIdParam), adminAuditService.audit('branch.staff.reset_password', { resourceType: 'user' }), branchSelfController.resetMyStaffPassword);
branchSelfRouter.put('/:id', validate(branchSelfValidation.updateMyBranch), adminAuditService.audit('branch.self.update', { resourceType: 'branch' }), branchSelfController.updateMyBranch);
router.use('/my-branch', branchSelfRouter);

// Role-based section guard: Super/legacy-admin pass everything; Manager is
// blocked from financial sections; Staff is limited to operations. The section
// is inferred from the request path so every route (incl. writes) is covered.
router.use((req, res, next) => {
  const section = sectionForPath(req.path);
  if (!canAccess(req.user.role, section)) {
    return next(ApiError.forbidden('You do not have access to this section'));
  }
  // Walled admins (User.branchIds set, any role) are further confined to
  // surfaces whose DATA is branch-scoped server-side. This stops a
  // branch-scoped manager/staff from reading a not-yet-scoped section
  // (delivery/inquiries/customers/coupons/etc) that would expose other
  // branches. The allow-set widens as more entities get scoped.
  const walled = Array.isArray(req.user.branchIds) && req.user.branchIds.length > 0;
  if (walled && !BRANCHADMIN_SECTIONS.has(section)) {
    return next(ApiError.forbidden('You do not have access to this section'));
  }
  return next();
});

// Attach branch data-scope (owner vs walled) to every admin request. Read by
// handlers via resolveBranchIds(req.branchScope, req.query.branchId).
router.use(require('../../middleware/branchScope'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);
router.get('/sales', adminController.getSales);
router.get('/profit', adminController.getProfit);
// Owner-only by-branch comparison (segment maps to an owner-only section).
router.get('/branch-breakdown', adminController.getBranchBreakdown);
router.get('/variants', adminController.listVariants);
router.get('/customer-analytics', adminController.getCustomerAnalytics);
router.get('/gst', adminController.getGstReport);

// Settings, company, admin-user management, scheduled reports
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.get('/company', adminController.getCompany);
router.get('/admins', adminController.listAdminUsers);
router.post('/admins', superAdminAuth, validate(adminValidation.createAdminUser), adminAuditService.audit('admin.user.create', { resourceType: 'user' }), adminController.createAdminUser);
router.put('/admins/:id/role', superAdminAuth, validate(adminValidation.setAdminRole), adminAuditService.audit('admin.role.update', { resourceType: 'user' }), adminController.setAdminRole);
router.put('/admins/:id/active', superAdminAuth, validate(adminValidation.setAdminActive), adminAuditService.audit('admin.user.active', { resourceType: 'user' }), adminController.setAdminActive);
router.put('/admins/:id/branches', superAdminAuth, validate(adminValidation.setAdminBranches), adminAuditService.audit('admin.user.branches', { resourceType: 'user' }), adminController.setAdminBranches);
router.post('/admins/:id/reset-password', superAdminAuth, validate(adminValidation.paramId), adminAuditService.audit('admin.user.reset_password', { resourceType: 'user' }), adminController.resetAdminPassword);
router.post('/reports/send-daily', adminController.sendDailyReportNow);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/operational-alerts', adminController.getOperationalAlerts);
router.get('/application-errors', adminController.getApplicationErrors);
router.get('/payment-diagnostics', adminController.getPaymentDiagnostics);
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
router.get('/products/:id/variants', validate(adminValidation.paramId), adminController.getProductVariants);
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
// Branches (store locations) — under /delivery so they inherit the 'delivery'
// access section (operations roles can read for invoices + zone assignment).
router.get('/delivery/branches', adminController.getBranches);
router.post('/delivery/branches', validate(deliveryValidation.createBranch), adminAuditService.audit('branch.create', { resourceType: 'branch' }), adminController.createBranch);
router.put('/delivery/branches/:id', validate(adminValidation.paramId), validate(deliveryValidation.updateBranch), adminAuditService.audit('branch.update', { resourceType: 'branch' }), adminController.updateBranch);

// Add-Ons
router.get('/addons', adminController.listAddOns);
router.post('/addons', validate(addonValidation.createAddOn), adminAuditService.audit('addon.create', { resourceType: 'addon' }), adminController.createAddOn);
router.put('/addons/:id', validate(adminValidation.updateAddOn), adminAuditService.audit('addon.update', { resourceType: 'addon' }), adminController.updateAddOn);
router.delete('/addons/:id', validate(adminValidation.paramId), adminAuditService.audit('addon.delete', { resourceType: 'addon' }), adminController.deleteAddOn);

// Inquiries
router.get('/inquiries/custom', adminController.getCustomInquiries);
router.get('/inquiries/corporate', adminController.getCorporateInquiries);
router.put('/inquiries/:id', validate(adminValidation.updateInquiry), adminAuditService.audit('inquiry.update', { resourceType: 'inquiry' }), adminController.updateInquiry);
router.post('/inquiries/:id/quote', validate(adminValidation.sendInquiryQuote), adminAuditService.audit('inquiry.quote.send', { resourceType: 'inquiry' }), adminController.sendInquiryQuote);

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
