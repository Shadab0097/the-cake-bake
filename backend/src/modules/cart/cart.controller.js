const cartService = require('./cart.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user._id);
  ApiResponse.ok(cart).send(res);
});

const addItem = asyncHandler(async (req, res) => {
  const cart = await cartService.addItem(req.user._id, req.body);
  ApiResponse.ok(cart, 'Item added to cart').send(res);
});

const updateItem = asyncHandler(async (req, res) => {
  const cart = await cartService.updateItem(req.user._id, req.params.itemId, req.body);
  ApiResponse.ok(cart, 'Cart updated').send(res);
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user._id, req.params.itemId);
  ApiResponse.ok(cart, 'Item removed').send(res);
});

const applyCoupon = asyncHandler(async (req, res) => {
  const cart = await cartService.applyCoupon(req.user._id, req.body.code);
  ApiResponse.ok(cart, 'Coupon applied').send(res);
});

const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await cartService.removeCoupon(req.user._id);
  ApiResponse.ok(cart, 'Coupon removed').send(res);
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user._id);
  ApiResponse.ok(cart, 'Cart cleared').send(res);
});

module.exports = { getCart, addItem, updateItem, removeItem, applyCoupon, removeCoupon, clearCart };
