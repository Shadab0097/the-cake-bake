const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const quoteTokenParam = Joi.object({
  token: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{24,160}$/).required(),
});

const deliverySlotSchema = Joi.alternatives().try(
  Joi.string().trim().max(100).allow('').default(''),
  Joi.object({
    label: Joi.string().trim().max(100).allow('').default('').custom(joiSanitize),
    startTime: Joi.string().trim().max(30).allow('').default('').custom(joiSanitize),
    endTime: Joi.string().trim().max(30).allow('').default('').custom(joiSanitize),
  }).messages(joiXssMessages)
);

const shippingAddressSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required().custom(joiSanitize),
  phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).required().messages({
    'string.pattern.base': 'Phone must be 10-15 digits',
  }),
  addressLine1: Joi.string().trim().min(5).max(200).required().custom(joiSanitize),
  addressLine2: Joi.string().trim().max(200).allow('').default('').custom(joiSanitize),
  city: Joi.string().trim().min(2).max(100).required().custom(joiSanitize),
  state: Joi.string().trim().min(2).max(100).required().custom(joiSanitize),
  pincode: Joi.string().trim().pattern(/^[0-9]{6}$/).required().messages({
    'string.pattern.base': 'Pincode must be 6 digits',
  }),
  landmark: Joi.string().trim().max(200).allow('').default('').custom(joiSanitize),
}).messages(joiXssMessages);

const customCakeInquiry = {
  body: Joi.object({
    name: Joi.string().trim().required().custom(joiSanitize),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().trim().required(),
    occasion: Joi.string().allow('').default('').custom(joiSanitize),
    flavor: Joi.string().allow('').default('').custom(joiSanitize),
    weight: Joi.string().allow('').default(''),
    message: Joi.string().allow('').max(120).default('').custom(joiSanitize),
    servingCount: Joi.number().min(0).default(0),
    designDescription: Joi.string().required().custom(joiSanitize),
    referenceImages: Joi.array().items(Joi.string()).max(5).default([]),
    referenceImagePublicIds: Joi.array().items(Joi.string()).max(5).default([]),
    deliveryDate: Joi.date().iso().allow(null, ''),
    city: Joi.string().allow('').default('').custom(joiSanitize),
    budget: Joi.string().allow('').default('').custom(joiSanitize),
  }).messages(joiXssMessages),
};

const corporateInquiry = {
  body: Joi.object({
    companyName: Joi.string().trim().required().custom(joiSanitize),
    contactName: Joi.string().trim().required().custom(joiSanitize),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().trim().required(),
    eventType: Joi.string().allow('').default('').custom(joiSanitize),
    quantity: Joi.number().min(1).default(1),
    budget: Joi.string().allow('').default('').custom(joiSanitize),
    deliveryDate: Joi.date().iso().allow(null, ''),
    city: Joi.string().allow('').default('').custom(joiSanitize),
    requirements: Joi.string().required().custom(joiSanitize),
    referenceImages: Joi.array().items(Joi.string()).max(5).default([]),
    referenceImagePublicIds: Joi.array().items(Joi.string()).max(5).default([]),
  }).messages(joiXssMessages),
};

const getQuote = {
  params: quoteTokenParam,
};

const acceptQuote = {
  params: quoteTokenParam,
  body: Joi.object({
    shippingAddress: shippingAddressSchema.required(),
    deliveryDate: Joi.date().iso().required(),
    deliverySlot: deliverySlotSchema.default(''),
  }).messages(joiXssMessages),
};

const verifyQuotePayment = {
  params: quoteTokenParam,
  body: Joi.object({
    razorpayOrderId: Joi.string().trim().required(),
    razorpayPaymentId: Joi.string().trim().required(),
    razorpaySignature: Joi.string().trim().required(),
  }),
};

module.exports = { customCakeInquiry, corporateInquiry, getQuote, acceptQuote, verifyQuotePayment };
