const Joi = require('joi');
const { joiSanitize, joiXssMessages } = require('../../utils/xssSanitizer');

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).custom(joiSanitize).required(),
    email: Joi.string().email().lowercase().trim().required(),
    // Phone: optional, but must be digits only with optional leading +
    phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).optional().messages({
      'string.pattern.base': 'Phone number must be 10-15 digits, optionally starting with +',
    }),
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

// verify-phone: accepts phone number and OTP code
const verifyPhone = {
  body: Joi.object({
    phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).required().messages({
      'string.pattern.base': 'Phone number must be 10-15 digits, optionally starting with +',
    }),
    otp: Joi.string().trim().length(6).optional(),
  }),
};

module.exports = { register, login, refreshToken, forgotPassword, resetPassword, verifyPhone };

