const mongoose = require('mongoose');

const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: '',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      required: true,
      default: 'processing',
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    lockedUntil: {
      type: Date,
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
    },
    lastError: {
      type: String,
      default: '',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

razorpayWebhookEventSchema.index({ status: 1, lockedUntil: 1 });
razorpayWebhookEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RazorpayWebhookEvent', razorpayWebhookEventSchema);
