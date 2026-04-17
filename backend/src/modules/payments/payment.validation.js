const Joi = require('joi');

const verifyPayment = {
  body: Joi.object({
    razorpayOrderId: Joi.string().required(),
    razorpayPaymentId: Joi.string().required(),
    razorpaySignature: Joi.string().required(),
  }),
};

module.exports = { verifyPayment };
