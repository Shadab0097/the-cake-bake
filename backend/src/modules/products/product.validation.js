const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');
const { safeImageUrl } = require('../../utils/urlValidation');

const createProduct = {
  body: Joi.object({
    name: Joi.string().trim().max(200).required().custom(joiSanitize),
    description: Joi.string().allow('').default('').custom(joiSanitize),
    shortDescription: Joi.string().max(300).allow('').default('').custom(joiSanitize),
    category: Joi.string().required(),
    tags: Joi.array().items(Joi.string().trim()).default([]),
    occasions: Joi.array().items(Joi.string().trim()).default([]),
    flavors: Joi.array().items(Joi.string().trim()).default([]),
    basePrice: Joi.number().min(0).required(),
    images: Joi.array().items(Joi.object({
      url: Joi.string().trim().required().custom(safeImageUrl),
      publicId: Joi.string().allow('').default(''),
      alt: Joi.string().allow('').default('').custom(joiSanitize),
      sortOrder: Joi.number().default(0),
    })).default([]),
    isEggless: Joi.boolean().default(false),
    hasEgglessOption: Joi.boolean().default(true),
    egglessExtraPrice: Joi.number().min(0).default(0),
    isVeg: Joi.boolean().default(true),
    minWeight: Joi.string().default('0.5 kg'),
    allowCustomMessage: Joi.boolean().default(true),
    isFeatured: Joi.boolean().default(false),
    cities: Joi.array().items(Joi.string().trim()).default([]),
    seo: Joi.object({
      title: Joi.string().allow('').default('').custom(joiSanitize),
      description: Joi.string().allow('').default('').custom(joiSanitize),
      keywords: Joi.string().allow('').default('').custom(joiSanitize),
    }).default({}),
    variants: Joi.array().items(Joi.object({
      weight: Joi.string().required(),
      price: Joi.number().min(0).required(),
      compareAtPrice: Joi.number().min(0).default(0),
      sku: Joi.string().allow('').default(''),
      stock: Joi.number().min(0).default(999),
    })).default([]),
  }).messages(joiXssMessages),
};

const updateProduct = {
  params: Joi.object({ id: Joi.string().required() }),
  body: Joi.object({
    name: Joi.string().trim().max(200).custom(joiSanitize),
    description: Joi.string().allow('').custom(joiSanitize),
    shortDescription: Joi.string().max(300).allow('').custom(joiSanitize),
    category: Joi.string(),
    tags: Joi.array().items(Joi.string().trim()),
    occasions: Joi.array().items(Joi.string().trim()),
    flavors: Joi.array().items(Joi.string().trim()),
    basePrice: Joi.number().min(0),
    images: Joi.array().items(Joi.object({
      url: Joi.string().trim().required().custom(safeImageUrl),
      publicId: Joi.string().allow('').default(''),
      alt: Joi.string().allow('').default('').custom(joiSanitize),
      sortOrder: Joi.number().default(0),
    })),
    isEggless: Joi.boolean(),
    hasEgglessOption: Joi.boolean(),
    egglessExtraPrice: Joi.number().min(0),
    isVeg: Joi.boolean(),
    minWeight: Joi.string(),
    allowCustomMessage: Joi.boolean(),
    isFeatured: Joi.boolean(),
    isActive: Joi.boolean(),
    cities: Joi.array().items(Joi.string().trim()),
    seo: Joi.object({
      title: Joi.string().allow('').custom(joiSanitize),
      description: Joi.string().allow('').custom(joiSanitize),
      keywords: Joi.string().allow('').custom(joiSanitize),
    }),
  }).messages(joiXssMessages),
};

module.exports = { createProduct, updateProduct };
