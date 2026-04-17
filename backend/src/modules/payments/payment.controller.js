const paymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const verifyPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyPayment(req.user._id, req.body);
  ApiResponse.ok(result, 'Payment verified').send(res);
});

const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body.toString();
  const result = await paymentService.handleWebhook(rawBody, signature);
  res.status(200).json(result);
});

module.exports = { verifyPayment, handleWebhook };
