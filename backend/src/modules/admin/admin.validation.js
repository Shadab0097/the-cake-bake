const Joi = require('joi');
const { ORDER_STATUSES, INQUIRY_STATUSES } = require('../../utils/constants');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

// Reusable ObjectId pattern for params validation
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const idParam = Joi.object({ id: Joi.string().pattern(objectIdPattern).required() });

const updateOrderStatus = {
  params: idParam,
  body: Joi.object({
    status: Joi.string().valid(...Object.values(ORDER_STATUSES)).required(),
    note: Joi.string().max(500).allow('').default('').custom(joiSanitize),
  }).messages(joiXssMessages),
};

// ---- Banner ----
const createBanner = {
  body: Joi.object({
    title: Joi.string().trim().max(200).required().custom(joiSanitize),
    subtitle: Joi.string().trim().max(300).allow('').default('').custom(joiSanitize),
    imageUrl: Joi.string().required(),
    linkUrl: Joi.string().allow('').default(''),
    position: Joi.string().valid('hero', 'promo', 'category').default('hero'),
    sortOrder: Joi.number().default(0),
    isActive: Joi.boolean().default(true),
  }).messages(joiXssMessages),
};

const updateBanner = {
  params: idParam,
  body: Joi.object({
    title: Joi.string().trim().max(200).custom(joiSanitize),
    subtitle: Joi.string().trim().max(300).allow('').custom(joiSanitize),
    imageUrl: Joi.string(),
    linkUrl: Joi.string().allow(''),
    position: Joi.string().valid('hero', 'promo', 'category'),
    sortOrder: Joi.number(),
    isActive: Joi.boolean(),
  }).messages(joiXssMessages),
};

// ---- Bulk Import ----
const bulkImportProducts = {
  body: Joi.object({
    products: Joi.array().items(Joi.object()).min(1).max(500).required(),
  }),
};

// ---- Generic ID param validation ----
const paramId = {
  params: idParam,
};

// ---- Category (admin update — was missing) ----
const updateCategory = {
  params: idParam,
  body: Joi.object({
    name: Joi.string().trim().max(100).custom(joiSanitize),
    description: Joi.string().allow('').custom(joiSanitize),
    image: Joi.string().allow(''),
    isActive: Joi.boolean(),
    sortOrder: Joi.number(),
  }).messages(joiXssMessages),
};

// ---- Coupon (admin update — was missing) ----
const updateCoupon = {
  params: idParam,
  body: Joi.object({
    code: Joi.string().trim().uppercase(),
    description: Joi.string().allow('').custom(joiSanitize),
    type: Joi.string().valid('percentage', 'flat'),
    value: Joi.number().min(0),
    minOrderAmount: Joi.number().min(0),
    maxDiscount: Joi.number().min(0),
    validFrom: Joi.date().iso(),
    validUntil: Joi.date().iso(),
    usageLimit: Joi.number().min(0),
    perUserLimit: Joi.number().min(0),
    isActive: Joi.boolean(),
  }).messages(joiXssMessages),
};

// ---- Inquiry (admin update) ----
const updateInquiry = {
  params: idParam,
  body: Joi.object({
    status: Joi.string().valid(...Object.values(INQUIRY_STATUSES)),
    adminNotes: Joi.string().allow('').max(2000).custom(joiSanitize),
    quotedPrice: Joi.number().min(0),
  }).messages(joiXssMessages),
};

// ---- Manual Notification ----
const sendNotification = {
  body: Joi.object({
    phone: Joi.string().trim().required(),
    templateName: Joi.string().trim().required(),
    params: Joi.array().items(Joi.string()).default([]),
  }),
};

module.exports = {
  updateOrderStatus,
  createBanner,
  updateBanner,
  bulkImportProducts,
  paramId,
  updateCategory,
  updateCoupon,
  updateInquiry,
  sendNotification,
};
