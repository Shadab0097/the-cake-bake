'use strict';

const express = require('express');
const router = express.Router();
const chatbotController = require('./chatbot.controller');

/**
 * Public webhook routes — called by Meta Cloud API, no JWT auth.
 *
 * GET  /api/v1/chatbot/webhook  → Meta one-time webhook verification
 * POST /api/v1/chatbot/webhook  → Incoming WhatsApp messages
 */
router.get('/webhook', chatbotController.webhookVerify);
router.post('/webhook', chatbotController.webhookHandler);

module.exports = router;
