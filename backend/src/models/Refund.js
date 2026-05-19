const mongoose = require('mongoose');
const { REFUND_STATUSES } = require('../utils/constants');

const refundEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(REFUND_STATUSES),
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const refundSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUSES),
      default: REFUND_STATUSES.REQUESTED,
      index: true,
    },
    reason: {
      type: String,
      default: '',
    },
    requestedBy: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      default: 'customer',
    },
    requestedByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    razorpayRefundId: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    processedAt: {
      type: Date,
    },
    events: [refundEventSchema],
  },
  { timestamps: true }
);

refundSchema.index({ order: 1, payment: 1 }, { unique: true });
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index(
  { razorpayRefundId: 1 },
  { partialFilterExpression: { razorpayRefundId: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.model('Refund', refundSchema);
