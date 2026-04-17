const reviewService = require('./review.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getProductReviews = asyncHandler(async (req, res) => {
  const result = await reviewService.getProductReviews(req.params.productId, req.query);
  ApiResponse.ok(result).send(res);
});

const createReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createReview(req.user._id, req.body);
  ApiResponse.created(review, 'Review submitted for approval').send(res);
});

const updateReview = asyncHandler(async (req, res) => {
  const review = await reviewService.updateReview(req.user._id, req.params.id, req.body);
  ApiResponse.ok(review, 'Review updated').send(res);
});

const deleteReview = asyncHandler(async (req, res) => {
  await reviewService.deleteReview(req.user._id, req.params.id);
  ApiResponse.ok(null, 'Review deleted').send(res);
});

module.exports = { getProductReviews, createReview, updateReview, deleteReview };
