const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const customCakeInquiry = {
  body: Joi.object({
    name: Joi.string().trim().required().custom(joiSanitize),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().trim().required(),
    occasion: Joi.string().allow('').default('').custom(joiSanitize),
    flavor: Joi.string().allow('').default('').custom(joiSanitize),
    weight: Joi.string().allow('').default(''),
    servingCount: Joi.number().min(0).default(0),
    designDescription: Joi.string().required().custom(joiSanitize),
    referenceImages: Joi.array().items(Joi.string()).max(5).default([]),
    deliveryDate: Joi.date().iso().allow(null),
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
    deliveryDate: Joi.date().iso().allow(null),
    city: Joi.string().allow('').default('').custom(joiSanitize),
    requirements: Joi.string().required().custom(joiSanitize),
  }).messages(joiXssMessages),
};

module.exports = { customCakeInquiry, corporateInquiry };
