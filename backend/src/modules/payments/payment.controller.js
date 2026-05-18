const paymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const idempotencyService = require('../orders/idempotency.service');

const verifyPayment = asyncHandler(async (req, res) => {
  const key = idempotencyService.getKeyFromRequest(req) ||
    `payment-verify:${req.user._id}:${req.body.razorpayOrderId}:${req.body.razorpayPaymentId}`;

  const result = await idempotencyService.execute({
    key,
    scope: 'payment_verify',
    user: req.user._id,
    payload: req.body,
    handler: () => paymentService.verifyPayment(req.user._id, req.body),
  });
  ApiResponse.ok(result, 'Payment verified').send(res);
});

const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body.toString();
  const result = await paymentService.handleWebhook(rawBody, signature);
  res.status(200).json(result);
});

module.exports = { verifyPayment, handleWebhook };
