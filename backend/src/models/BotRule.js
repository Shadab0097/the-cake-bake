'use strict';

const mongoose = require('mongoose');

/**
 * BotRule — keyword-to-response mapping for the WhatsApp chatbot.
 *
 * When a customer sends a message that matches a rule's keyword
 * (using the configured matchType strategy), the bot sends the
 * corresponding response text automatically.
 */
const botRuleSchema = new mongoose.Schema(
  {
    keyword: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    response: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    /**
     * Matching strategy:
     *  - exact     → whole message equals keyword
     *  - contains  → message contains keyword anywhere
     *  - startsWith → message starts with keyword
     */
    matchType: {
      type: String,
      enum: ['exact', 'contains', 'startsWith'],
      default: 'contains',
    },
    category: {
      type: String,
      enum: ['greeting', 'order', 'support', 'faq', 'custom'],
      default: 'custom',
    },
    /** Higher priority = checked first */
    priority: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

botRuleSchema.index({ isActive: 1, priority: -1 });
botRuleSchema.index({ category: 1 });

module.exports = mongoose.model('BotRule', botRuleSchema);
