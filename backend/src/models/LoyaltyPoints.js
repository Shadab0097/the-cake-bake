const mongoose = require('mongoose');
const { LOYALTY_TYPES } = require('../utils/constants');

const loyaltyPointsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    points: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(LOYALTY_TYPES),
      required: true,
    },
    source: {
      type: String,
      enum: ['order', 'review', 'referral', 'admin', 'signup'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    eventType: {
      type: String,
      default: '',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

loyaltyPointsSchema.index({ user: 1, createdAt: -1 });
loyaltyPointsSchema.index({ type: 1 });
loyaltyPointsSchema.index(
  { user: 1, referenceId: 1, eventType: 1 },
  { unique: true, partialFilterExpression: { eventType: { $exists: true, $gt: '' } } }
);

module.exports = mongoose.model('LoyaltyPoints', loyaltyPointsSchema);
