const mongoose = require('mongoose');

const applicationErrorEventSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ['error', 'warn'],
      default: 'error',
      index: true,
    },
    source: {
      type: String,
      default: 'api',
      index: true,
    },
    processRole: {
      type: String,
      default: '',
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      default: '',
      index: true,
    },
    method: {
      type: String,
      default: '',
      index: true,
    },
    path: {
      type: String,
      default: '',
      index: true,
    },
    route: {
      type: String,
      default: '',
    },
    statusCode: {
      type: Number,
      default: 500,
      index: true,
    },
    name: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: true,
      index: true,
    },
    stack: {
      type: String,
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurrenceCount: {
      type: Number,
      default: 1,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

applicationErrorEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
applicationErrorEventSchema.index({ fingerprint: 1, lastSeenAt: -1 });
applicationErrorEventSchema.index({ statusCode: 1, lastSeenAt: -1 });
applicationErrorEventSchema.index({ requestId: 1, lastSeenAt: -1 });
applicationErrorEventSchema.index({ path: 1, lastSeenAt: -1 });

module.exports = mongoose.model('ApplicationErrorEvent', applicationErrorEventSchema);
