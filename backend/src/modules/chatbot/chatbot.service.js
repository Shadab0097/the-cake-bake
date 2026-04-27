'use strict';

const BotRule = require('../../models/BotRule');
const ChatbotLog = require('../../models/ChatbotLog');
const whatsappService = require('../notifications/whatsapp.service');
const logger = require('../../middleware/logger');
const { env } = require('../../config/env');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

class ChatbotService {

  // ─────────────────────────────────────────────────────────────────────────
  // CORE: Process an incoming WhatsApp message and auto-reply
  // ─────────────────────────────────────────────────────────────────────────

  async processIncomingMessage(senderPhone, messageText) {
    if (!messageText || !senderPhone) return;

    const normalizedText = messageText.trim().toLowerCase();

    // Load all active rules, sorted highest priority first
    const rules = await BotRule.find({ isActive: true }).sort({ priority: -1, createdAt: 1 }).lean();

    let matchedRule = null;

    for (const rule of rules) {
      const keyword = rule.keyword; // already stored lowercase

      if (rule.matchType === 'exact' && normalizedText === keyword) {
        matchedRule = rule;
        break;
      }
      if (rule.matchType === 'contains' && normalizedText.includes(keyword)) {
        matchedRule = rule;
        break;
      }
      if (rule.matchType === 'startsWith' && normalizedText.startsWith(keyword)) {
        matchedRule = rule;
        break;
      }
    }

    const responseText = matchedRule
      ? matchedRule.response
      : (env.chatbot?.fallbackMessage || 'Thank you for reaching out! 🎂 Our team will get back to you shortly.');

    // Send reply via existing WhatsApp service (within 24h session window)
    let delivered = false;
    try {
      const result = await whatsappService.sendTextMessage(senderPhone, responseText);
      delivered = result.success === true;
    } catch (err) {
      logger.warn('[Chatbot] Failed to send reply to', senderPhone, err.message);
    }

    // Log conversation (non-blocking)
    ChatbotLog.create({
      senderPhone,
      incomingMessage: messageText.substring(0, 500),
      matchedKeyword: matchedRule ? matchedRule.keyword : null,
      matchedRuleId: matchedRule ? matchedRule._id : null,
      matchType: matchedRule ? matchedRule.matchType : 'fallback',
      outgoingResponse: responseText.substring(0, 1000),
      delivered,
    }).catch((err) => logger.warn('[Chatbot] Log write failed:', err.message));

    logger.info(`[Chatbot] ${matchedRule ? `Matched "${matchedRule.keyword}"` : 'Fallback'} → replied to ${senderPhone}`);

    return { matched: !!matchedRule, keyword: matchedRule?.keyword, delivered };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Bot Rule CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async listRules(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.category) filter.category = query.category;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.search) {
      filter.keyword = { $regex: query.search.toLowerCase(), $options: 'i' };
    }

    const [rules, total] = await Promise.all([
      BotRule.find(filter).sort({ priority: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      BotRule.countDocuments(filter),
    ]);

    return paginatedResponse(rules, total, page, limit);
  }

  async createRule(data) {
    // Check duplicate keyword
    const existing = await BotRule.findOne({ keyword: data.keyword.toLowerCase().trim() });
    if (existing) {
      const err = new Error(`A rule with keyword "${data.keyword}" already exists`);
      err.statusCode = 409;
      throw err;
    }
    return BotRule.create(data);
  }

  async updateRule(id, data) {
    const rule = await BotRule.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!rule) {
      const err = new Error('Bot rule not found');
      err.statusCode = 404;
      throw err;
    }
    return rule;
  }

  async deleteRule(id) {
    const rule = await BotRule.findByIdAndDelete(id);
    if (!rule) {
      const err = new Error('Bot rule not found');
      err.statusCode = 404;
      throw err;
    }
    return rule;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Conversation Logs
  // ─────────────────────────────────────────────────────────────────────────

  async getLogs(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.phone) filter.senderPhone = { $regex: query.phone, $options: 'i' };
    if (query.matched === 'true') filter.matchedKeyword = { $ne: null };
    if (query.matched === 'false') filter.matchedKeyword = null;

    const [logs, total] = await Promise.all([
      ChatbotLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ChatbotLog.countDocuments(filter),
    ]);

    return paginatedResponse(logs, total, page, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADMIN: Quick Stats
  // ─────────────────────────────────────────────────────────────────────────

  async getStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalRules, activeRules, totalMessages, todayMessages, matchedMessages] = await Promise.all([
      BotRule.countDocuments(),
      BotRule.countDocuments({ isActive: true }),
      ChatbotLog.countDocuments(),
      ChatbotLog.countDocuments({ createdAt: { $gte: todayStart } }),
      ChatbotLog.countDocuments({ matchedKeyword: { $ne: null } }),
    ]);

    // Top matched keywords (last 500 logs)
    const topKeywords = await ChatbotLog.aggregate([
      { $match: { matchedKeyword: { $ne: null } } },
      { $group: { _id: '$matchedKeyword', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const matchRate = totalMessages > 0
      ? Math.round((matchedMessages / totalMessages) * 100)
      : 0;

    return {
      totalRules,
      activeRules,
      totalMessages,
      todayMessages,
      matchedMessages,
      matchRate,
      topKeywords,
    };
  }
}

module.exports = new ChatbotService();
