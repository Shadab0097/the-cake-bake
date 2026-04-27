'use strict';

const chatbotService = require('./chatbot.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');
const { env } = require('../../config/env');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Meta Webhook Verification
// GET /api/v1/chatbot/webhook
// ─────────────────────────────────────────────────────────────────────────────
const webhookVerify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    logger.info('[Chatbot] Webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  logger.warn('[Chatbot] Webhook verification failed — token mismatch or wrong mode');
  return res.status(403).json({ error: 'Forbidden' });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Receive Incoming WhatsApp Messages
// POST /api/v1/chatbot/webhook
// ─────────────────────────────────────────────────────────────────────────────
const webhookHandler = asyncHandler(async (req, res) => {
  // Always respond 200 immediately — Meta will retry if it doesn't get a fast 200
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // Validate top-level WhatsApp payload structure
    if (body?.object !== 'whatsapp_business_account') return;

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!Array.isArray(messages) || messages.length === 0) return;

    for (const msg of messages) {
      // Only process text messages
      if (msg.type !== 'text') continue;

      const senderPhone = msg.from;        // e.g. "919876543210"
      const messageText = msg.text?.body;

      if (!senderPhone || !messageText) continue;

      logger.info(`[Chatbot] Incoming from ${senderPhone}: "${messageText.substring(0, 80)}"`);

      // Process asynchronously — reply is non-blocking
      chatbotService.processIncomingMessage(senderPhone, messageText).catch((err) => {
        logger.error('[Chatbot] processIncomingMessage error:', err.message);
      });
    }
  } catch (err) {
    logger.error('[Chatbot] webhookHandler error:', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Bot Rule CRUD
// ─────────────────────────────────────────────────────────────────────────────
const listRules = asyncHandler(async (req, res) => {
  const result = await chatbotService.listRules(req.query);
  ApiResponse.ok(result).send(res);
});

const createRule = asyncHandler(async (req, res) => {
  const rule = await chatbotService.createRule(req.body);
  ApiResponse.created(rule, 'Bot rule created').send(res);
});

const updateRule = asyncHandler(async (req, res) => {
  const rule = await chatbotService.updateRule(req.params.id, req.body);
  ApiResponse.ok(rule, 'Bot rule updated').send(res);
});

const deleteRule = asyncHandler(async (req, res) => {
  await chatbotService.deleteRule(req.params.id);
  ApiResponse.ok(null, 'Bot rule deleted').send(res);
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Logs & Stats
// ─────────────────────────────────────────────────────────────────────────────
const getChatbotLogs = asyncHandler(async (req, res) => {
  const result = await chatbotService.getLogs(req.query);
  ApiResponse.ok(result).send(res);
});

const getChatbotStats = asyncHandler(async (req, res) => {
  const result = await chatbotService.getStats();
  ApiResponse.ok(result).send(res);
});

module.exports = {
  webhookVerify,
  webhookHandler,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  getChatbotLogs,
  getChatbotStats,
};
