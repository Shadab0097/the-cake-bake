const Joi = require('joi');

const checkPincode = {
  body: Joi.object({
    pincode: Joi.string().trim().pattern(/^[1-9][0-9]{5}$/).required().messages({
      'string.pattern.base': 'Pincode must be a valid 6-digit Indian pincode',
    }),
  }),
};

const reverseGeocode = {
  body: Joi.object({
    lat: Joi.number().min(-90).max(90).required().messages({
      'number.base': 'Latitude must be a number',
      'number.min': 'Latitude is out of range',
      'number.max': 'Latitude is out of range',
    }),
    lng: Joi.number().min(-180).max(180).required().messages({
      'number.base': 'Longitude must be a number',
      'number.min': 'Longitude is out of range',
      'number.max': 'Longitude is out of range',
    }),
  }),
};

const createSlot = {
  body: Joi.object({
    label: Joi.string().trim().required(),
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
    maxOrders: Joi.number().min(1).default(50),
    extraCharge: Joi.number().min(0).default(0),
    cities: Joi.array().items(Joi.string().trim()).default([]),
    sortOrder: Joi.number().default(0),
  }),
};

const createZone = {
  body: Joi.object({
    state: Joi.string().trim().required(),
    city: Joi.string().trim().required(),
    pincodes: Joi.array().items(Joi.string().trim()).default([]),
    areas: Joi.array().items(Joi.string().trim()).default([]),
    deliveryCharge: Joi.number().min(0).default(0),
    freeDeliveryAbove: Joi.number().min(0).default(0),
    sameDayAvailable: Joi.boolean().default(true),
    sameDayCutoffTime: Joi.string().default('14:00'),
    codEnabled: Joi.boolean().default(true),
    status: Joi.string().valid('live', 'coming_soon').default('live'),
    isActive: Joi.boolean().default(true),
    branchId: Joi.string().hex().length(24).allow(null, ''),
  }),
};

const originSchema = Joi.object({
  addressLine1: Joi.string().trim().allow(''),
  addressLine2: Joi.string().trim().allow(''),
  city: Joi.string().trim().allow(''),
  state: Joi.string().trim().allow(''),
  pincode: Joi.string().trim().allow(''),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
});

const createBranch = {
  body: Joi.object({
    name: Joi.string().trim().required(),
    code: Joi.string().trim().allow('').default(''),
    origin: originSchema.default({}),
    invoicePrefix: Joi.string().trim().allow('').default(''),
    codEnabled: Joi.boolean().default(true),
    reportRecipients: Joi.array().items(Joi.string().trim()).default([]),
    reportEnabled: Joi.boolean().default(false),
    isActive: Joi.boolean().default(true),
  }),
};

const updateBranch = {
  body: Joi.object({
    name: Joi.string().trim(),
    code: Joi.string().trim().allow(''),
    origin: originSchema,
    invoicePrefix: Joi.string().trim().allow(''),
    codEnabled: Joi.boolean(),
    reportRecipients: Joi.array().items(Joi.string().trim()),
    reportEnabled: Joi.boolean(),
    isActive: Joi.boolean(),
  }).min(1),
};

module.exports = { checkPincode, reverseGeocode, createSlot, createZone, createBranch, updateBranch };
