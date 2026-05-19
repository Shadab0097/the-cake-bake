const mongoose = require('mongoose');

const operationalAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
      index: true,
    },
    source: {
      type: String,
      default: 'system',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'resolved'],
      default: 'open',
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
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
    },
    notifiedAt: {
      type: Date,
    },
    lastNotificationError: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

operationalAlertSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string', $gt: '' } } }
);
operationalAlertSchema.index({ severity: 1, status: 1, lastSeenAt: -1 });
operationalAlertSchema.index({ type: 1, lastSeenAt: -1 });

module.exports = mongoose.model('OperationalAlert', operationalAlertSchema);
