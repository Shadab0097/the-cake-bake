const Joi = require('joi');

const verifyPayment = {
  body: Joi.object({
    razorpayOrderId: Joi.string(),
    razorpayPaymentId: Joi.string(),
    razorpaySignature: Joi.string(),
    razorpay_order_id: Joi.string(),
    razorpay_payment_id: Joi.string(),
    razorpay_signature: Joi.string(),
  })
    .custom((value, helpers) => {
      const normalized = {
        razorpayOrderId: value.razorpayOrderId || value.razorpay_order_id,
        razorpayPaymentId: value.razorpayPaymentId || value.razorpay_payment_id,
        razorpaySignature: value.razorpaySignature || value.razorpay_signature,
      };

      if (!normalized.razorpayOrderId || !normalized.razorpayPaymentId || !normalized.razorpaySignature) {
        return helpers.error('any.custom');
      }

      return normalized;
    }, 'Razorpay payment payload normalization')
    .messages({
      'any.custom': 'Payment verification payload is incomplete',
    }),
};

module.exports = { verifyPayment };
