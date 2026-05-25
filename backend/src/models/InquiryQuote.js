const mongoose = require('mongoose');
const { INQUIRY_QUOTE_STATUSES } = require('../utils/constants');

const inquiryQuoteSchema = new mongoose.Schema(
  {
    inquiryType: {
      type: String,
      enum: ['custom_cake', 'corporate'],
      required: true,
      index: true,
    },
    inquiry: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
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
    notes: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: Object.values(INQUIRY_QUOTE_STATUSES),
      default: INQUIRY_QUOTE_STATUSES.SENT,
      index: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    convertedAt: {
      type: Date,
    },
    quotedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    customer: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  { timestamps: true }
);

inquiryQuoteSchema.index({ inquiryType: 1, inquiry: 1, version: -1 });
inquiryQuoteSchema.index({ status: 1, expiresAt: 1 });
inquiryQuoteSchema.index(
  { tokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { tokenHash: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('InquiryQuote', inquiryQuoteSchema);
