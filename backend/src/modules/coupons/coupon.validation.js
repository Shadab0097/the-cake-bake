const Joi = require('joi');

const validateCoupon = {
  body: Joi.object({
    code: Joi.string().trim().required(),
    cartSubtotal: Joi.number().min(0).required(),
  }),
};

const createCoupon = {
  body: Joi.object({
    code: Joi.string().trim().uppercase().required(),
    description: Joi.string().allow('').default(''),
    type: Joi.string().valid('percentage', 'flat').required(),
    value: Joi.number().min(0).required(),
    minOrderAmount: Joi.number().min(0).default(0),
    maxDiscount: Joi.number().min(0).default(0),
    validFrom: Joi.date().iso().required(),
    validUntil: Joi.date().iso().required(),
    usageLimit: Joi.number().min(0).default(0),
    perUserLimit: Joi.number().min(1).default(1),
    applicableCategories: Joi.array().items(Joi.string()).default([]),
    applicableProducts: Joi.array().items(Joi.string()).default([]),
  }),
};

module.exports = { validateCoupon, createCoupon };
