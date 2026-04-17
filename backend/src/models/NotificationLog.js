const mongoose = require('mongoose');
const { NOTIFICATION_CHANNELS } = require('../utils/constants');

const notificationLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    channel: {
      type: String,
      enum: Object.values(NOTIFICATION_CHANNELS),
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    recipient: {
      type: String,
      required: true,
    },
    templateName: {
      type: String,
      default: '',
    },
    templateParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    externalId: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

notificationLogSchema.index({ user: 1, createdAt: -1 });
notificationLogSchema.index({ channel: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
