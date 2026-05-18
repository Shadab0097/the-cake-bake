const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    scope: {
      type: String,
      enum: ['checkout', 'guest_checkout', 'payment_verify'],
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestFingerprint: {
      type: String,
      default: '',
      index: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      required: true,
      default: 'processing',
      index: true,
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
    },
    lockedUntil: {
      type: Date,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    lastError: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

idempotencyKeySchema.index({ scope: 1, key: 1 }, { unique: true });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
