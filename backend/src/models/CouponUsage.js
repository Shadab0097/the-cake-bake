const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true,
    },
    guestEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    guestPhone: {
      type: String,
      default: '',
      trim: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

couponUsageSchema.index({ coupon: 1, user: 1 });
couponUsageSchema.index({ coupon: 1, order: 1 }, { unique: true });
couponUsageSchema.index(
  { coupon: 1, user: 1, order: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } }
);
couponUsageSchema.index({ coupon: 1, guestEmail: 1 });
couponUsageSchema.index({ coupon: 1, guestPhone: 1 });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
