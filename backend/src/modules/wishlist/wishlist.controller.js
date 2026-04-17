const wishlistService = require('./wishlist.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlist(req.user._id);
  ApiResponse.ok(wishlist).send(res);
});

const addToWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.addToWishlist(req.user._id, req.params.productId);
  ApiResponse.ok(wishlist, 'Added to wishlist').send(res);
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.removeFromWishlist(req.user._id, req.params.productId);
  ApiResponse.ok(wishlist, 'Removed from wishlist').send(res);
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
