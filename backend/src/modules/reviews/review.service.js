const mongoose = require('mongoose');
const Review = require('../../models/Review');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

class ReviewService {
  async getProductReviews(productId, query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { product: productId, isApproved: true };

    if (query.rating) filter.rating = parseInt(query.rating, 10);

    let sort = { createdAt: -1 };
    if (query.sort === 'helpful') sort = { helpfulCount: -1 };
    if (query.sort === 'rating_high') sort = { rating: -1 };
    if (query.sort === 'rating_low') sort = { rating: 1 };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name avatar')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    // Rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    return {
      ...paginatedResponse(reviews, total, page, limit),
      ratingDistribution,
    };
  }

  async createReview(userId, data) {
    const { productId, orderId, rating, title, comment, images } = data;

    // Check if already reviewed
    const existing = await Review.findOne({ user: userId, product: productId });
    if (existing) throw ApiError.conflict('You have already reviewed this product');

    // Check verified purchase
    let isVerified = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        'items.product': productId,
        status: 'delivered',
      });
      if (order) isVerified = true;
    }

    const review = await Review.create({
      product: productId,
      user: userId,
      order: orderId || undefined,
      rating,
      title: title || '',
      comment: comment || '',
      images: images || [],
      isVerified,
      isApproved: false, // Requires admin approval
    });

    return review;
  }

  async updateReview(userId, reviewId, data) {
    const review = await Review.findOne({ _id: reviewId, user: userId });
    if (!review) throw ApiError.notFound('Review not found');

    if (data.rating) review.rating = data.rating;
    if (data.title !== undefined) review.title = data.title;
    if (data.comment !== undefined) review.comment = data.comment;
    if (data.images) review.images = data.images;
    review.isApproved = false; // Re-moderate on edit

    await review.save();
    return review;
  }

  async deleteReview(userId, reviewId) {
    const review = await Review.findOneAndDelete({ _id: reviewId, user: userId });
    if (!review) throw ApiError.notFound('Review not found');
    await this.updateProductRating(review.product);
    return review;
  }

  async approveReview(reviewId) {
    const review = await Review.findByIdAndUpdate(reviewId, { isApproved: true }, { new: true });
    if (!review) throw ApiError.notFound('Review not found');
    await this.updateProductRating(review.product);
    return review;
  }

  async updateProductRating(productId) {
    const stats = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId), isApproved: true } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const avg = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
    const count = stats.length > 0 ? stats[0].reviewCount : 0;

    await Product.findByIdAndUpdate(productId, {
      averageRating: avg,
      reviewCount: count,
    });
  }

  async adminListReviews(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.isApproved !== undefined) filter.isApproved = query.isApproved === 'true';

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name email')
        .populate('product', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    return paginatedResponse(reviews, total, page, limit);
  }
}

module.exports = new ReviewService();
