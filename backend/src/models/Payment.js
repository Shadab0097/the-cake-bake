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
    refundStatus: {
      type: String,
      enum: ['', 'requested', 'approved', 'processing', 'refunded', 'failed'],
      default: '',
      index: true,
    },
    refundRequestedAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
    },
    webhookEvents: [
      {
        eventId: { type: String, default: '' },
        event: { type: String },
        payload: { type: mongoose.Schema.Types.Mixed },
        receivedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

paymentSchema.index(
  { razorpayOrderId: 1 },
  { partialFilterExpression: { razorpayOrderId: { $type: 'string', $gt: '' } } }
);
paymentSchema.index(
  { razorpayPaymentId: 1 },
  { partialFilterExpression: { razorpayPaymentId: { $type: 'string', $gt: '' } } }
);
paymentSchema.index({ status: 1 });
paymentSchema.index({ status: 1, createdAt: 1 });
paymentSchema.index({ 'webhookEvents.eventId': 1 });

module.exports = mongoose.model('Payment', paymentSchema);
