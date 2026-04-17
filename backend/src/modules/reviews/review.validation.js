const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const createReview = {
  body: Joi.object({
    productId: Joi.string().required(),
    orderId: Joi.string().allow('').default(''),
    rating: Joi.number().integer().min(1).max(5).required(),
    title: Joi.string().max(200).allow('').default('').custom(joiSanitize),
    comment: Joi.string().max(1000).allow('').default('').custom(joiSanitize),
    images: Joi.array().items(Joi.string()).max(5).default([]),
  }).messages(joiXssMessages),
};

const updateReview = {
  params: Joi.object({ id: Joi.string().required() }),
  body: Joi.object({
    rating: Joi.number().integer().min(1).max(5),
    title: Joi.string().max(200).allow('').custom(joiSanitize),
    comment: Joi.string().max(1000).allow('').custom(joiSanitize),
    images: Joi.array().items(Joi.string()).max(5),
  }).messages(joiXssMessages),
};

module.exports = { createReview, updateReview };
