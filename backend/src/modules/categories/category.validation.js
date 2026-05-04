const Joi = require('joi');
const { safeImageUrl } = require('../../utils/urlValidation');

const createCategory = {
  body: Joi.object({
    name: Joi.string().trim().max(100).required(),
    description: Joi.string().allow('').default(''),
    image: Joi.string().trim().allow('').default('').custom(safeImageUrl),
    imagePublicId: Joi.string().allow('').default(''),
    parentCategory: Joi.string().allow(null).default(null),
    sortOrder: Joi.number().default(0),
    seo: Joi.object({
      title: Joi.string().allow('').default(''),
      description: Joi.string().allow('').default(''),
      keywords: Joi.string().allow('').default(''),
    }).default({}),
  }),
};

module.exports = { createCategory };
