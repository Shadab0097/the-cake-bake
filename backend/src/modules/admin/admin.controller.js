const adminService = require('./admin.service');
const productService = require('../products/product.service');
const orderService = require('../orders/order.service');
const couponService = require('../coupons/coupon.service');
const deliveryService = require('../delivery/delivery.service');
const addonService = require('../addons/addon.service');
const inquiryService = require('../inquiries/inquiry.service');
const reviewService = require('../reviews/review.service');
const notificationService = require('../notifications/notification.service');
const adminAuditService = require('./adminAudit.service');
const operationalAlertService = require('../monitoring/operationalAlert.service');
const applicationErrorEventService = require('../monitoring/applicationErrorEvent.service');
const refundService = require('../payments/refund.service');
const paymentDiagnosticsService = require('../payments/paymentDiagnostics.service');
const Banner = require('../../models/Banner');
const Category = require('../../models/Category');
const AddOn = require('../../models/AddOn');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const uploadService = require('../media/upload.service');
const cache = require('../../utils/cache');
const { resolveBranchIds, orderBranchMatch, withBranch, toObjectIds, computeScope } = require('../../utils/branchScope');

// Id-level branch guard. Owner (null scope) passes through untouched; a walled
// admin may touch a row only if it belongs to one of their branches. Uses the
// exact same match as the list endpoints so a detail/action route can never be
// a side door into another branch's data. A miss returns 404 (not 403) so we
// never confirm the existence of an out-of-branch record.
async function assertOrderInScope(req, orderId) {
  const scopeIds = resolveBranchIds(req.branchScope);
  if (!scopeIds) return; // owner / HQ — no constraint
  const Order = require('../../models/Order');
  const match = await orderBranchMatch(scopeIds);
  const ok = await Order.exists(withBranch({ _id: orderId }, match));
  if (!ok) throw ApiError.notFound('Order not found');
}

// The caller's branch set for entity-level scoping: null for an owner/HQ admin
// (no constraint) or a string[] of their branchIds for a walled admin.
function scopeBranchIds(req) {
  return req.branchScope?.global ? null : req.branchScope.branchIds;
}

async function assertRefundInScope(req, refundId) {
  const scopeIds = resolveBranchIds(req.branchScope);
  if (!scopeIds) return; // owner / HQ — no constraint
  const Refund = require('../../models/Refund');
  const ids = toObjectIds({ branchIds: scopeIds });
  // Refunds snapshot branchId; legacy refunds (null) stay owner-only, so a
  // walled admin matching against their own ids simply won't see them.
  const ok = await Refund.exists(withBranch({ _id: refundId }, { branchId: { $in: ids } }));
  if (!ok) throw ApiError.notFound('Refund not found');
}

const normalizeBannerPayload = (payload = {}) => {
  const data = { ...payload };
  if (data.imageUrl !== undefined) {
    data.image = { ...(data.image || {}), desktop: data.imageUrl, mobile: data.imageUrl };
    delete data.imageUrl;
  }
  if (data.imagePublicId !== undefined && typeof data.imagePublicId === 'string') {
    data.imagePublicId = { desktop: data.imagePublicId, mobile: data.imagePublicId };
  }
  if (data.linkUrl !== undefined && !data.link) {
    data.link = data.linkUrl;
  }
  delete data.linkUrl;
  return data;
};

// ---- Identity / branch scope ----
// Who am I + which branches may I act on. Powers the admin branch picker: owner
// sees all active branches (+ an "All" option, added client-side); a walled
// admin sees only their assigned branches and the picker locks to them.
const getMe = asyncHandler(async (req, res) => {
  const Branch = require('../../models/Branch');
  const scope = computeScope(req.user);
  const filter = scope.global ? { isActive: true } : { _id: { $in: scope.branchIds } };
  const branches = await Branch.find(filter).select('name code isActive').sort({ name: 1 }).lean();
  ApiResponse.ok({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    branchIds: (req.user.branchIds || []).map(String),
    isBranchScoped: !scope.global,
    branches,
  }).send(res);
});

// ---- Dashboard ----
const getDashboard = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const data = await adminService.getDashboard({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(data).send(res);
});

const getAnalytics = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const data = await adminService.getAnalytics({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(data).send(res);
});

const getSales = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const data = await adminService.getSalesAnalytics({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(data).send(res);
});

const getProfit = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const data = await adminService.getProfitAnalytics({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(data).send(res);
});

// Owner-only "compare all branches" breakdown (route maps to an owner-only
// section). A walled caller is scoped to their branches by resolveBranchIds.
const getBranchBreakdown = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const data = await adminService.getBranchBreakdown({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(data).send(res);
});

const listVariants = asyncHandler(async (req, res) => {
  const data = await adminService.listVariantsForCosting(req.query);
  ApiResponse.ok(data).send(res);
});

const getCustomerAnalytics = asyncHandler(async (req, res) => {
  const data = await adminService.getCustomerAnalytics(req.query);
  ApiResponse.ok(data).send(res);
});

const getGstReport = asyncHandler(async (req, res) => {
  const data = await adminService.getGstReport(req.query);
  ApiResponse.ok(data).send(res);
});

// ---- Settings / Company / Admin users / Reports ----
const getSettings = asyncHandler(async (req, res) => {
  const data = await adminService.getSettings();
  ApiResponse.ok(data).send(res);
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = await adminService.updateSettings(req.body);
  ApiResponse.ok(data, 'Settings updated').send(res);
});

const getCompany = asyncHandler(async (req, res) => {
  const data = await adminService.getCompany();
  ApiResponse.ok(data).send(res);
});

const listAdminUsers = asyncHandler(async (req, res) => {
  const data = await adminService.listAdminUsers();
  ApiResponse.ok(data).send(res);
});

const setAdminRole = asyncHandler(async (req, res) => {
  const data = await adminService.setAdminRole(req.params.id, req.body.role, req.user._id);
  ApiResponse.ok(data, 'Role updated').send(res);
});

const createAdminUser = asyncHandler(async (req, res) => {
  const data = await adminService.createAdminUser(req.body, req.user._id);
  ApiResponse.created(data, 'Admin user created').send(res);
});

const setAdminActive = asyncHandler(async (req, res) => {
  const data = await adminService.setAdminActive(req.params.id, req.body.isActive, req.user._id);
  ApiResponse.ok(data, data.isActive ? 'User activated' : 'User deactivated').send(res);
});

const setAdminBranches = asyncHandler(async (req, res) => {
  const data = await adminService.setAdminBranches(req.params.id, req.body.branchIds, req.user._id);
  ApiResponse.ok(data, 'Branch access updated').send(res);
});

const resetAdminPassword = asyncHandler(async (req, res) => {
  const data = await adminService.resetAdminPassword(req.params.id, req.user._id);
  ApiResponse.ok(data, 'Password reset').send(res);
});

const sendDailyReportNow = asyncHandler(async (req, res) => {
  const reportService = require('./report.service');
  const result = await reportService.sendDailyReport();
  ApiResponse.ok(result, result.success ? 'Report sent' : 'Report not sent — check email config and recipients').send(res);
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await adminAuditService.list(req.query);
  ApiResponse.ok(result).send(res);
});

const getOperationalAlerts = asyncHandler(async (req, res) => {
  const result = await operationalAlertService.list(req.query);
  ApiResponse.ok(result).send(res);
});

const getApplicationErrors = asyncHandler(async (req, res) => {
  const result = await applicationErrorEventService.list(req.query);
  ApiResponse.ok(result).send(res);
});

const getPaymentDiagnostics = asyncHandler(async (req, res) => {
  const result = await paymentDiagnosticsService.trace(req.query);
  ApiResponse.ok(result).send(res);
});

const getRefunds = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const result = await refundService.list({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(result).send(res);
});

const approveRefund = asyncHandler(async (req, res) => {
  await assertRefundInScope(req, req.params.id);
  const refund = await refundService.approve(req.params.id, req.user._id, req.body?.note || 'Refund approved');
  ApiResponse.ok(refund, 'Refund approved').send(res);
});

const processRefund = asyncHandler(async (req, res) => {
  await assertRefundInScope(req, req.params.id);
  const refund = await refundService.processApproved(req.params.id, req.user._id);
  ApiResponse.ok(refund, 'Refund processed').send(res);
});

const failRefund = asyncHandler(async (req, res) => {
  await assertRefundInScope(req, req.params.id);
  const refund = await refundService.markFailed(req.params.id, req.user._id, req.body?.reason || 'Refund failed');
  ApiResponse.ok(refund, 'Refund marked failed').send(res);
});

// ---- Products ----
const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.adminListProducts(req.query);
  ApiResponse.ok(result).send(res);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  ApiResponse.created(product, 'Product created').send(res);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  ApiResponse.ok(product, 'Product updated').send(res);
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  ApiResponse.ok(null, 'Product deactivated').send(res);
});

const addVariant = asyncHandler(async (req, res) => {
  const variant = await productService.addVariant(req.params.id, req.body);
  ApiResponse.created(variant, 'Variant added').send(res);
});

const updateVariant = asyncHandler(async (req, res) => {
  const variant = await productService.updateVariant(req.params.id, req.params.vid, req.body);
  ApiResponse.ok(variant, 'Variant updated').send(res);
});

const getProductVariants = asyncHandler(async (req, res) => {
  const variants = await productService.adminGetVariants(req.params.id);
  ApiResponse.ok(variants).send(res);
});

// ---- Categories ----
const categoryService = require('../categories/category.service');

const listCategories = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  ApiResponse.ok(categories).send(res);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  ApiResponse.created(category, 'Category created').send(res);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  ApiResponse.ok(category, 'Category updated').send(res);
});

const deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  ApiResponse.ok(null, 'Category deactivated').send(res);
});

// ---- Orders ----
const getOrders = asyncHandler(async (req, res) => {
  const branchIds = resolveBranchIds(req.branchScope, req.query.branchId);
  const result = await orderService.adminGetOrders({ ...req.query, branchIds: branchIds || [] });
  ApiResponse.ok(result).send(res);
});

const getOrderDetail = asyncHandler(async (req, res) => {
  const Order = require('../../models/Order');
  const scopeIds = resolveBranchIds(req.branchScope);
  const match = await orderBranchMatch(scopeIds || []); // {} for owner
  const order = await Order.findOne(withBranch({ _id: req.params.id }, match))
    .populate('user', 'name email phone')
    .populate('paymentId')
    .lean();
  if (!order) throw ApiError.notFound('Order not found');
  ApiResponse.ok(order).send(res);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  await assertOrderInScope(req, req.params.id);
  const order = await orderService.updateOrderStatus(
    req.params.id,
    req.body.status,
    req.body.note,
    req.user._id
  );

  // Trigger WhatsApp notification for status change
  await notificationService.sendStatusUpdate(order, req.body.status);

  ApiResponse.ok(order, 'Order status updated').send(res);
});

// ---- Coupons ----
const listCoupons = asyncHandler(async (req, res) => {
  const result = await couponService.listCoupons(req.query, scopeBranchIds(req));
  ApiResponse.ok(result).send(res);
});

const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await couponService.createCoupon(req.body, scopeBranchIds(req));
  ApiResponse.created(coupon, 'Coupon created').send(res);
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await couponService.updateCoupon(req.params.id, req.body, scopeBranchIds(req));
  ApiResponse.ok(coupon, 'Coupon updated').send(res);
});

const deleteCoupon = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.params.id, scopeBranchIds(req));
  ApiResponse.ok(null, 'Coupon deactivated').send(res);
});

// ---- Delivery ----
const getSlots = asyncHandler(async (req, res) => {
  const slots = await deliveryService.adminGetSlots();
  ApiResponse.ok(slots).send(res);
});

const createSlot = asyncHandler(async (req, res) => {
  const slot = await deliveryService.createSlot(req.body);
  ApiResponse.created(slot, 'Delivery slot created').send(res);
});

const updateSlot = asyncHandler(async (req, res) => {
  const slot = await deliveryService.updateSlot(req.params.id, req.body);
  ApiResponse.ok(slot, 'Slot updated').send(res);
});

const getZones = asyncHandler(async (req, res) => {
  const zones = await deliveryService.adminGetZones();
  ApiResponse.ok(zones).send(res);
});

const createZone = asyncHandler(async (req, res) => {
  const zone = await deliveryService.createZone(req.body);
  ApiResponse.created(zone, 'Delivery zone created').send(res);
});

const updateZone = asyncHandler(async (req, res) => {
  const zone = await deliveryService.updateZone(req.params.id, req.body);
  ApiResponse.ok(zone, 'Zone updated').send(res);
});

const getBranches = asyncHandler(async (req, res) => {
  const branches = await deliveryService.adminGetBranches();
  ApiResponse.ok(branches).send(res);
});

const createBranch = asyncHandler(async (req, res) => {
  const branch = await deliveryService.createBranch(req.body);
  ApiResponse.created(branch, 'Branch created').send(res);
});

const updateBranch = asyncHandler(async (req, res) => {
  const branch = await deliveryService.updateBranch(req.params.id, req.body);
  ApiResponse.ok(branch, 'Branch updated').send(res);
});

// ---- Add-Ons ----
const listAddOns = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
  if (req.query.category) filter.category = req.query.category;
  const addons = await AddOn.find(filter).sort({ category: 1, sortOrder: 1 }).lean();
  ApiResponse.ok(addons).send(res);
});

const createAddOn = asyncHandler(async (req, res) => {
  const addon = await addonService.createAddOn(req.body);
  ApiResponse.created(addon, 'Add-on created').send(res);
});

const updateAddOn = asyncHandler(async (req, res) => {
  const addon = await addonService.updateAddOn(req.params.id, req.body);
  ApiResponse.ok(addon, 'Add-on updated').send(res);
});

const deleteAddOn = asyncHandler(async (req, res) => {
  await addonService.deleteAddOn(req.params.id);
  ApiResponse.ok(null, 'Add-on deactivated').send(res);
});

// ---- Inquiries ----
const getCustomInquiries = asyncHandler(async (req, res) => {
  const result = await inquiryService.adminListCustomInquiries(req.query, scopeBranchIds(req));
  ApiResponse.ok(result).send(res);
});

const getCorporateInquiries = asyncHandler(async (req, res) => {
  const result = await inquiryService.adminListCorporateInquiries(req.query, scopeBranchIds(req));
  ApiResponse.ok(result).send(res);
});

const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.adminUpdateInquiry(req.params.id, req.body, scopeBranchIds(req));
  ApiResponse.ok(inquiry, 'Inquiry updated').send(res);
});

const sendInquiryQuote = asyncHandler(async (req, res) => {
  const inquiryQuoteService = require('../inquiries/inquiryQuote.service');
  const result = await inquiryQuoteService.sendQuote(req.params.id, req.body, req.user._id, scopeBranchIds(req));
  ApiResponse.created(result, 'Quote sent to customer').send(res);
});

// ---- Customers ----
const getCustomers = asyncHandler(async (req, res) => {
  const result = await adminService.getCustomers(req.query, scopeBranchIds(req));
  ApiResponse.ok(result).send(res);
});

const getCustomerDetail = asyncHandler(async (req, res) => {
  const result = await adminService.getCustomerDetail(req.params.id, scopeBranchIds(req));
  ApiResponse.ok(result).send(res);
});

const adjustCustomerPoints = asyncHandler(async (req, res) => {
  const { points, reason } = req.body;
  const result = await adminService.adjustCustomerPoints(req.params.id, points, reason, req.user._id, scopeBranchIds(req));
  ApiResponse.ok(result, 'Points adjusted').send(res);
});

// ---- Reviews ----
const getReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.adminListReviews(req.query);
  ApiResponse.ok(result).send(res);
});

const approveReview = asyncHandler(async (req, res) => {
  const review = await reviewService.approveReview(req.params.id);
  ApiResponse.ok(review, 'Review approved').send(res);
});

const deleteReview = asyncHandler(async (req, res) => {
  const Review = require('../../models/Review');
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw ApiError.notFound('Review not found');
  ApiResponse.ok(null, 'Review deleted').send(res);
});

// ---- Banners ----
const getBanners = asyncHandler(async (req, res) => {
  const banners = await Banner.find().sort({ position: 1, sortOrder: 1 }).lean();
  ApiResponse.ok(banners).send(res);
});

const createBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.create(normalizeBannerPayload(req.body));
  await cache.invalidatePattern('banners:');
  ApiResponse.created(banner, 'Banner created').send(res);
});

const updateBanner = asyncHandler(async (req, res) => {
  const existingBanner = await Banner.findById(req.params.id).select('imagePublicId').lean();
  const banner = await Banner.findByIdAndUpdate(req.params.id, normalizeBannerPayload(req.body), { new: true });
  if (!banner) throw ApiError.notFound('Banner not found');
  const oldPublicIds = [
    existingBanner?.imagePublicId?.desktop,
    existingBanner?.imagePublicId?.mobile,
  ].filter(Boolean);
  const nextPublicIds = new Set([
    banner.imagePublicId?.desktop,
    banner.imagePublicId?.mobile,
  ].filter(Boolean));
  uploadService.deleteImages(oldPublicIds.filter((publicId) => !nextPublicIds.has(publicId)));
  await cache.invalidatePattern('banners:');
  ApiResponse.ok(banner, 'Banner updated').send(res);
});

const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw ApiError.notFound('Banner not found');
  await uploadService.deleteImages([
    banner.imagePublicId?.desktop,
    banner.imagePublicId?.mobile,
  ]);
  await cache.invalidatePattern('banners:');
  ApiResponse.ok(null, 'Banner deleted').send(res);
});

// ---- Notifications ----
const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.adminGetNotifications(req.query);
  ApiResponse.ok(result).send(res);
});

// Send manual WhatsApp notification to a phone number
const sendManualNotification = asyncHandler(async (req, res) => {
  const { phone, templateName, params } = req.body;
  if (!phone || !templateName) throw ApiError.badRequest('phone and templateName are required');
  const whatsappService = require('../notifications/whatsapp.service');
  const result = await whatsappService.sendTemplateMessage(phone, templateName, params || []);
  ApiResponse.ok(result, 'Notification sent').send(res);
});

// Bulk import products from JSON array
const bulkImportProducts = asyncHandler(async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    throw ApiError.badRequest('products array is required');
  }
  const results = [];
  for (const productData of products) {
    try {
      const product = await productService.createProduct(productData);
      results.push({ success: true, name: productData.name, id: product._id });
    } catch (err) {
      results.push({ success: false, name: productData.name, error: err.message });
    }
  }
  ApiResponse.ok({ imported: results.filter(r => r.success).length, total: results.length, results }, 'Bulk import completed').send(res);
});

// ---- Chatbot (Bot Rules & Logs) ----
const chatbotService = require('../chatbot/chatbot.service');

const listBotRules = asyncHandler(async (req, res) => {
  const result = await chatbotService.listRules(req.query);
  ApiResponse.ok(result).send(res);
});

const createBotRule = asyncHandler(async (req, res) => {
  const rule = await chatbotService.createRule(req.body);
  ApiResponse.created(rule, 'Bot rule created').send(res);
});

const updateBotRule = asyncHandler(async (req, res) => {
  const rule = await chatbotService.updateRule(req.params.id, req.body);
  ApiResponse.ok(rule, 'Bot rule updated').send(res);
});

const deleteBotRule = asyncHandler(async (req, res) => {
  await chatbotService.deleteRule(req.params.id);
  ApiResponse.ok(null, 'Bot rule deleted').send(res);
});

const getChatbotLogs = asyncHandler(async (req, res) => {
  const result = await chatbotService.getLogs(req.query);
  ApiResponse.ok(result).send(res);
});

const getChatbotStats = asyncHandler(async (req, res) => {
  const result = await chatbotService.getStats();
  ApiResponse.ok(result).send(res);
});

module.exports = {
  getMe,
  getDashboard, getAnalytics, getSales, getProfit, getBranchBreakdown, listVariants, getCustomerAnalytics, getGstReport,
  getSettings, updateSettings, getCompany, listAdminUsers, setAdminRole, createAdminUser, setAdminActive, resetAdminPassword, setAdminBranches, sendDailyReportNow,
  getAuditLogs, getOperationalAlerts, getApplicationErrors, getPaymentDiagnostics, getRefunds, approveRefund, processRefund, failRefund,
  listProducts, createProduct, updateProduct, deleteProduct, addVariant, updateVariant, getProductVariants, bulkImportProducts,
  listCategories, createCategory, updateCategory, deleteCategory,
  getOrders, getOrderDetail, updateOrderStatus,
  listCoupons, createCoupon, updateCoupon, deleteCoupon,
  getSlots, createSlot, updateSlot, getZones, createZone, updateZone,
  getBranches, createBranch, updateBranch,
  listAddOns, createAddOn, updateAddOn, deleteAddOn,
  getCustomInquiries, getCorporateInquiries, updateInquiry, sendInquiryQuote,
  getCustomers, getCustomerDetail, adjustCustomerPoints,
  getReviews, approveReview, deleteReview,
  getBanners, createBanner, updateBanner, deleteBanner,
  getNotifications, sendManualNotification,
  listBotRules, createBotRule, updateBotRule, deleteBotRule, getChatbotLogs, getChatbotStats,
};
