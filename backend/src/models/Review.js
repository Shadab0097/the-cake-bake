const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    images: [
      {
        type: String,
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // One review per user per product

module.exports = mongoose.model('Review', reviewSchema);
