const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const createOrder = {
  body: Joi.object({
    addressId: Joi.string().allow(null).allow(''),
    deliveryDate: Joi.date().iso().min('now').required().messages({
      'date.min': 'Delivery date cannot be in the past',
    }),
    deliverySlot: Joi.alternatives()
      .try(
        Joi.object({
          label: Joi.string().allow(''),
          startTime: Joi.string().allow(''),
          endTime: Joi.string().allow(''),
        }),
        Joi.string().allow('')
      )
      .default({}),
    paymentMethod: Joi.string().valid('cod', 'online').default('cod'),
    specialInstructions: Joi.string().max(500).allow('').default('').custom(joiSanitize),
    isGift: Joi.boolean().default(false),
    giftMessage: Joi.string().max(300).allow('').default('').custom(joiSanitize),
    redeemPoints: Joi.boolean().default(false),
    shippingAddress: Joi.object({
      fullName: Joi.string().trim().required().custom(joiSanitize),
      phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).required(),
      addressLine1: Joi.string().trim().required().custom(joiSanitize),
      addressLine2: Joi.string().trim().allow('').default('').custom(joiSanitize),
      city: Joi.string().trim().required().custom(joiSanitize),
      state: Joi.string().trim().required().custom(joiSanitize),
      pincode: Joi.string().trim().required(),
      landmark: Joi.string().trim().allow('').default('').custom(joiSanitize),
    }),
  }).messages(joiXssMessages),
};

const validateCheckout = {
  body: Joi.object({
    addressId: Joi.string().allow(null).allow(''),
    deliveryDate: Joi.date().iso().min('now').required().messages({
      'date.min': 'Delivery date cannot be in the past',
    }),
    deliverySlotId: Joi.string().allow(''),
    shippingAddress: Joi.object({
      fullName: Joi.string().trim().required(),
      phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).required(),
      addressLine1: Joi.string().trim().required(),
      addressLine2: Joi.string().trim().allow(''),
      city: Joi.string().trim().required(),
      state: Joi.string().trim().required(),
      pincode: Joi.string().trim().required(),
      landmark: Joi.string().trim().allow(''),
    }),
  }),
};

module.exports = { createOrder, validateCheckout };

