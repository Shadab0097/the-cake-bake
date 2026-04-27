'use strict';

const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const idParam = Joi.object({ id: Joi.string().pattern(objectIdPattern).required() });

const createBotRule = {
  body: Joi.object({
    keyword: Joi.string().trim().lowercase().max(200).required().custom(joiSanitize),
    response: Joi.string().trim().max(1000).required().custom(joiSanitize),
    matchType: Joi.string().valid('exact', 'contains', 'startsWith').default('contains'),
    category: Joi.string().valid('greeting', 'order', 'support', 'faq', 'custom').default('custom'),
    priority: Joi.number().integer().min(0).max(100).default(0),
    isActive: Joi.boolean().default(true),
  }).messages(joiXssMessages),
};

const updateBotRule = {
  params: idParam,
  body: Joi.object({
    keyword: Joi.string().trim().lowercase().max(200).custom(joiSanitize),
    response: Joi.string().trim().max(1000).custom(joiSanitize),
    matchType: Joi.string().valid('exact', 'contains', 'startsWith'),
    category: Joi.string().valid('greeting', 'order', 'support', 'faq', 'custom'),
    priority: Joi.number().integer().min(0).max(100),
    isActive: Joi.boolean(),
  }).messages(joiXssMessages),
};

const paramId = { params: idParam };

module.exports = { createBotRule, updateBotRule, paramId };
