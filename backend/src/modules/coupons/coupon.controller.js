const couponService = require('./coupon.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const validateCoupon = asyncHandler(async (req, res) => {
  const result = await couponService.validateCoupon(req.user._id, req.body.code, req.body.cartSubtotal);
  ApiResponse.ok(result).send(res);
});

module.exports = { validateCoupon };
