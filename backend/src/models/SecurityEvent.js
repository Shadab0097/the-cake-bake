const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    scope: {
      type: String,
      enum: ['customer', 'admin', 'system'],
      default: 'system',
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    email: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      default: '',
      index: true,
    },
    userAgent: {
      type: String,
      default: '',
    },
    requestId: {
      type: String,
      default: '',
      index: true,
    },
    reason: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

securityEventSchema.index({ createdAt: -1 });
securityEventSchema.index({ type: 1, createdAt: -1 });
securityEventSchema.index({ scope: 1, email: 1, createdAt: -1 });
securityEventSchema.index({ scope: 1, ip: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
