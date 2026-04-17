const mongoose = require('mongoose');
const { PAYMENT_STATUSES } = require('../utils/constants');

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,   // null for guest orders
      default: null,
    },
    razorpayOrderId: {
      type: String,
      required: false,
      default: '',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    razorpaySignature: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.CREATED,
    },
    method: {
      type: String,
      default: '',
    },
    refundId: {
      type: String,
      default: '',
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    webhookEvents: [
      {
        event: { type: String },
        payload: { type: mongoose.Schema.Types.Mixed },
        receivedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
