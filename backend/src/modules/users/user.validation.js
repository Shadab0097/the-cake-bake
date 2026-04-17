const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const updateProfile = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).custom(joiSanitize),
    phone: Joi.string().trim().min(10).max(15),
  }).messages(joiXssMessages),
};

const createAddress = {
  body: Joi.object({
    label: Joi.string().trim().max(50).default('Home').custom(joiSanitize),
    fullName: Joi.string().trim().required().custom(joiSanitize),
    phone: Joi.string().trim().required(),
    addressLine1: Joi.string().trim().required().custom(joiSanitize),
    addressLine2: Joi.string().trim().allow('').default('').custom(joiSanitize),
    city: Joi.string().trim().required().custom(joiSanitize),
    state: Joi.string().trim().required().custom(joiSanitize),
    pincode: Joi.string().trim().required(),
    landmark: Joi.string().trim().allow('').default('').custom(joiSanitize),
    isDefault: Joi.boolean().default(false),
  }).messages(joiXssMessages),
};

const updateAddress = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
  body: Joi.object({
    label: Joi.string().trim().max(50).custom(joiSanitize),
    fullName: Joi.string().trim().custom(joiSanitize),
    phone: Joi.string().trim(),
    addressLine1: Joi.string().trim().custom(joiSanitize),
    addressLine2: Joi.string().trim().allow('').custom(joiSanitize),
    city: Joi.string().trim().custom(joiSanitize),
    state: Joi.string().trim().custom(joiSanitize),
    pincode: Joi.string().trim(),
    landmark: Joi.string().trim().allow('').custom(joiSanitize),
    isDefault: Joi.boolean(),
  }).messages(joiXssMessages),
};

module.exports = { updateProfile, createAddress, updateAddress };
