'use strict';

const express = require('express');
const router = express.Router();
const chatbotController = require('./chatbot.controller');
const metaWebhookService = require('./metaWebhook.service');
const { whatsappWebhookLimiter } = require('../../middleware/rateLimiter');

/**
 * Public webhook routes — called by Meta Cloud API, no JWT auth.
 *
 * GET  /api/v1/chatbot/webhook  → Meta one-time webhook verification
 * POST /api/v1/chatbot/webhook  → Incoming WhatsApp messages
 */
router.get('/webhook', chatbotController.webhookVerify);
router.post(
  '/webhook',
  whatsappWebhookLimiter,
  express.raw({ type: 'application/json', limit: '2mb' }),
  metaWebhookService.verifySignatureMiddleware,
  metaWebhookService.parseJsonBodyMiddleware,
  chatbotController.webhookHandler
);

module.exports = router;
