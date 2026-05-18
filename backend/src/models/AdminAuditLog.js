const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    parentResourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    actorRole: {
      type: String,
      default: '',
      index: true,
    },
    method: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
      index: true,
    },
    outcome: {
      type: String,
      enum: ['success', 'failure'],
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      default: '',
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
    changedFields: {
      type: [String],
      default: [],
    },
    body: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ actor: 1, createdAt: -1 });
adminAuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
adminAuditLogSchema.index({ action: 1, outcome: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
