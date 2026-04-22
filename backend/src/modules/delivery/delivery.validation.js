const Joi = require('joi');

const checkPincode = {
  body: Joi.object({
    pincode: Joi.string().trim().required(),
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
  }),
};

module.exports = { checkPincode, createSlot, createZone };
