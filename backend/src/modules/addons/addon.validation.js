const Joi = require('joi');
const { ADDON_CATEGORIES } = require('../../utils/constants');

const createAddOn = {
  body: Joi.object({
    name: Joi.string().trim().required(),
    description: Joi.string().allow('').default(''),
    image: Joi.string().allow('').default(''),
    price: Joi.number().min(0).required(),
    category: Joi.string().valid(...ADDON_CATEGORIES).required(),
    sortOrder: Joi.number().default(0),
  }),
};

module.exports = { createAddOn };
