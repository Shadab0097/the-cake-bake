const mongoose = require('mongoose');

const couponUsageCounterSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    identityType: {
      type: String,
      enum: ['user', 'guest_email', 'guest_phone'],
      required: true,
    },
    identityKey: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  { timestamps: true }
);

couponUsageCounterSchema.index({ coupon: 1, identityType: 1, identityKey: 1 }, { unique: true });

module.exports = mongoose.model('CouponUsageCounter', couponUsageCounterSchema);
