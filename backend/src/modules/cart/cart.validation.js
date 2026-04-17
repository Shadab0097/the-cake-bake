const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const addItem = {
  body: Joi.object({
    productId: Joi.string().required(),
    variantId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).max(50).default(1),
    addOns: Joi.array().items(Joi.string()).default([]),
    cakeMessage: Joi.string().max(100).allow('').default('').custom(joiSanitize),
    isEggless: Joi.boolean().default(false),
  }).messages(joiXssMessages),
};

const updateItem = {
  params: Joi.object({ itemId: Joi.string().required() }),
  body: Joi.object({
    quantity: Joi.number().integer().min(1).max(50),
    cakeMessage: Joi.string().max(100).allow('').custom(joiSanitize),
    isEggless: Joi.boolean(),
    addOns: Joi.array().items(Joi.string()),
  }),
};

const applyCoupon = {
  body: Joi.object({
    code: Joi.string().trim().required(),
  }),
};

module.exports = { addItem, updateItem, applyCoupon };
