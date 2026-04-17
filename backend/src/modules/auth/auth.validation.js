const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).custom(joiSanitize).required(),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().trim().min(10).max(15).optional(),
    password: Joi.string().min(6).max(128).required(),
  }).messages(joiXssMessages),
};

const login = {
  body: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().required(),
  }),
};

const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

const forgotPassword = {
  body: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
  }),
};

const resetPassword = {
  body: Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(6).max(128).required(),
  }),
};

module.exports = { register, login, refreshToken, forgotPassword, resetPassword };
