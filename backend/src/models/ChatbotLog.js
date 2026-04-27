'use strict';

const mongoose = require('mongoose');

/**
 * ChatbotLog — conversation history for the WhatsApp bot.
 *
 * Stores both incoming customer messages and the bot's outgoing
 * replies for analytics and debugging. Auto-deleted after 30 days
 * via MongoDB TTL index.
 */
const chatbotLogSchema = new mongoose.Schema(
  {
    senderPhone: {
      type: String,
      required: true,
      index: true,
    },
    incomingMessage: {
      type: String,
      required: true,
    },
    /** null when fallback response was sent (no rule matched) */
    matchedKeyword: {
      type: String,
      default: null,
    },
    matchedRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BotRule',
      default: null,
    },
    matchType: {
      type: String,
      enum: ['exact', 'contains', 'startsWith', 'fallback'],
      default: 'fallback',
    },
    outgoingResponse: {
      type: String,
      required: true,
    },
    /** Whether the WhatsApp API call succeeded */
    delivered: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

chatbotLogSchema.index({ createdAt: -1 });
chatbotLogSchema.index({ senderPhone: 1, createdAt: -1 });

// TTL — auto-delete logs after 30 days
chatbotLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('ChatbotLog', chatbotLogSchema);
