'use strict';

const { getWhatsAppClient } = require('../../config/whatsapp');
const { env } = require('../../config/env');
const logger = require('../../middleware/logger');

class WhatsAppService {
  /**
   * Whether the WhatsApp channel is enabled.
   * Controlled by ENABLE_WHATSAPP_NOTIFICATIONS env flag.
   * Credentials are also checked so the service doesn't crash on placeholder values.
   */
  get enabled() {
    return (
      env.notifications.whatsappEnabled &&
      !!env.whatsapp.accessToken &&
      env.whatsapp.accessToken !== 'placeholder' &&
      !!env.whatsapp.phoneNumberId &&
      env.whatsapp.phoneNumberId !== 'placeholder'
    );
  }

  /**
   * Send a template message via WhatsApp Cloud API
   */
  async sendTemplateMessage(recipientPhone, templateName, parameters = {}, languageCode = 'en') {
    if (!this.enabled) {
      logger.info(
        `[WhatsApp DISABLED] Would send template "${templateName}" to ${recipientPhone}. ` +
        `Set ENABLE_WHATSAPP_NOTIFICATIONS=true and add real credentials to activate.`
      );
      return { success: false, reason: 'WhatsApp not enabled or credentials not configured' };
    }

    try {
      const phone = this.formatPhone(recipientPhone);
      const components = this.buildTemplateComponents(parameters);

      const client = getWhatsAppClient();
      const response = await client.post('/messages', {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      });

      logger.info(`[WhatsApp] Template "${templateName}" sent to ${phone}`, {
        messageId: response.data?.messages?.[0]?.id,
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
        status: response.data?.messages?.[0]?.message_status,
      };
    } catch (error) {
      logger.error(`[WhatsApp] Failed to send template "${templateName}" to ${recipientPhone}`, {
        error: error.response?.data || error.message,
      });
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Send a text message (for utility/service messages within 24-hour window)
   */
  async sendTextMessage(recipientPhone, text) {
    if (!this.enabled) {
      logger.info(`[WhatsApp DISABLED] Would send text to ${recipientPhone}: ${text.substring(0, 80)}...`);
      return { success: false, reason: 'WhatsApp not enabled or credentials not configured' };
    }

    try {
      const phone = this.formatPhone(recipientPhone);
      const client = getWhatsAppClient();

      const response = await client.post('/messages', {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text },
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error(`[WhatsApp] Failed to send text to ${recipientPhone}`, {
        error: error.response?.data || error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Format phone number to E.164 (Indian numbers default to +91)
   */
  formatPhone(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith('91')) cleaned = '91' + cleaned;
    return cleaned;
  }

  /**
   * Build WhatsApp template body components from a key-value parameters object
   */
  buildTemplateComponents(parameters) {
    if (!parameters || Object.keys(parameters).length === 0) return [];

    const bodyParams = Object.values(parameters).map((value) => ({
      type: 'text',
      text: String(value),
    }));

    return [
      {
        type: 'body',
        parameters: bodyParams,
      },
    ];
  }
}

module.exports = new WhatsAppService();

