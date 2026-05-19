const orderService = require('./order.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const idempotencyService = require('./idempotency.service');
const codAbuseService = require('./codAbuse.service');

const validateCheckout = asyncHandler(async (req, res) => {
  const result = await orderService.validateCheckout(req.user._id, req.body);
  ApiResponse.ok({ valid: true }, 'Checkout validated').send(res);
});

const createOrder = asyncHandler(async (req, res) => {
  const requestContext = codAbuseService.buildRequestContext(req);
  const result = await idempotencyService.execute({
    key: idempotencyService.getKeyFromRequest(req),
    scope: 'checkout',
    user: req.user._id,
    payload: req.body,
    handler: () => orderService.createOrder(req.user._id, req.body, { requestContext }),
  });

  ApiResponse.created(result, 'Order created').send(res);
});

const getOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getOrders(req.user._id, req.query);
  ApiResponse.ok(result).send(res);
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderByNumber(req.user._id, req.params.orderNumber);
  ApiResponse.ok(order).send(res);
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(req.user._id, req.params.orderNumber);
  ApiResponse.ok(order, 'Order cancelled').send(res);
});

module.exports = { validateCheckout, createOrder, getOrders, getOrder, cancelOrder };
