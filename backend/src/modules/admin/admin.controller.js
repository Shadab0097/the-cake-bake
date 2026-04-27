const adminService = require('./admin.service');
const productService = require('../products/product.service');
const orderService = require('../orders/order.service');
const couponService = require('../coupons/coupon.service');
const deliveryService = require('../delivery/delivery.service');
const addonService = require('../addons/addon.service');
const inquiryService = require('../inquiries/inquiry.service');
const reviewService = require('../reviews/review.service');
const notificationService = require('../notifications/notification.service');
const Banner = require('../../models/Banner');
const Category = require('../../models/Category');
const AddOn = require('../../models/AddOn');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

// ---- Dashboard ----
const getDashboard = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboard(req.query);
  ApiResponse.ok(data).send(res);
});

const getAnalytics = asyncHandler(async (req, res) => {
  const data = await adminService.getAnalytics(req.query);
  ApiResponse.ok(data).send(res);
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
  const result = await orderService.adminGetOrders(req.query);
  ApiResponse.ok(result).send(res);
});

const getOrderDetail = asyncHandler(async (req, res) => {
  const Order = require('../../models/Order');
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('paymentId')
    .lean();
  if (!order) throw ApiError.notFound('Order not found');
  ApiResponse.ok(order).send(res);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
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
  const result = await couponService.listCoupons(req.query);
  ApiResponse.ok(result).send(res);
});

const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await couponService.createCoupon(req.body);
  ApiResponse.created(coupon, 'Coupon created').send(res);
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await couponService.updateCoupon(req.params.id, req.body);
  ApiResponse.ok(coupon, 'Coupon updated').send(res);
});

const deleteCoupon = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.params.id);
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
  const result = await inquiryService.adminListCustomInquiries(req.query);
  ApiResponse.ok(result).send(res);
});

const getCorporateInquiries = asyncHandler(async (req, res) => {
  const result = await inquiryService.adminListCorporateInquiries(req.query);
  ApiResponse.ok(result).send(res);
});

const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.adminUpdateInquiry(req.params.id, req.body);
  ApiResponse.ok(inquiry, 'Inquiry updated').send(res);
});

// ---- Customers ----
const getCustomers = asyncHandler(async (req, res) => {
  const result = await adminService.getCustomers(req.query);
  ApiResponse.ok(result).send(res);
});

const getCustomerDetail = asyncHandler(async (req, res) => {
  const result = await adminService.getCustomerDetail(req.params.id);
  ApiResponse.ok(result).send(res);
});

const adjustCustomerPoints = asyncHandler(async (req, res) => {
  const { points, reason } = req.body;
  const result = await adminService.adjustCustomerPoints(req.params.id, points, reason, req.user._id);
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
  const banner = await Banner.create(req.body);
  ApiResponse.created(banner, 'Banner created').send(res);
});

const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!banner) throw ApiError.notFound('Banner not found');
  ApiResponse.ok(banner, 'Banner updated').send(res);
});

const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw ApiError.notFound('Banner not found');
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
  getDashboard, getAnalytics,
  listProducts, createProduct, updateProduct, deleteProduct, addVariant, updateVariant, bulkImportProducts,
  listCategories, createCategory, updateCategory, deleteCategory,
  getOrders, getOrderDetail, updateOrderStatus,
  listCoupons, createCoupon, updateCoupon, deleteCoupon,
  getSlots, createSlot, updateSlot, getZones, createZone, updateZone,
  listAddOns, createAddOn, updateAddOn, deleteAddOn,
  getCustomInquiries, getCorporateInquiries, updateInquiry,
  getCustomers, getCustomerDetail, adjustCustomerPoints,
  getReviews, approveReview, deleteReview,
  getBanners, createBanner, updateBanner, deleteBanner,
  getNotifications, sendManualNotification,
  listBotRules, createBotRule, updateBotRule, deleteBotRule, getChatbotLogs, getChatbotStats,
};
