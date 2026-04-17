const mongoose = require('mongoose');
const { COUPON_TYPES } = require('../utils/constants');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: Object.values(COUPON_TYPES),
      required: true,
    },
    value: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      default: 0, // 0 means no cap
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: 0, // 0 means unlimited
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
    },
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
