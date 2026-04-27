'use strict';

const nodemailer = require('nodemailer');
const { env } = require('../../config/env');
const logger = require('../../middleware/logger');
const EMAIL_TEMPLATES = require('./email.templates');

class EmailService {
  constructor() {
    this._transporter = null;
    this._ready = false;

    // Only initialise if the global toggle is on AND credentials exist
    if (env.notifications.emailEnabled && env.smtp.user && env.smtp.pass &&
        !env.smtp.user.includes('placeholder') && !env.smtp.pass.includes('placeholder')) {
      this._init();
    } else {
      logger.info('[Email] Service disabled or credentials not configured. Set ENABLE_EMAIL_NOTIFICATIONS=true with valid SMTP credentials to activate.');
    }
  }

  /**
   * Initialise the Nodemailer SMTP transporter (called once at startup).
   * Verifies the connection so startup logs reveal misconfig immediately.
   */
  _init() {
    this._transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,  // false = STARTTLS (port 587), true = SSL (port 465)
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
      // Graceful timeout — prevents the server from hanging on SMTP issues
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });

    // Verify connection on startup — non-blocking
    this._transporter.verify((error) => {
      if (error) {
        logger.error('[Email] SMTP connection verification failed:', error.message);
        // Don't crash the server — just mark as not ready
        this._ready = false;
      } else {
        logger.info(`[Email] SMTP transporter ready → ${env.smtp.host}:${env.smtp.port}`);
        this._ready = true;
      }
    });
  }

  /**
   * Core send method. Used by all higher-level helpers.
   * @param {string|string[]} to  - Recipient email address(es)
   * @param {string} subject      - Email subject line
   * @param {string} html         - Full HTML body
   * @returns {{ success: boolean, messageId?: string, error?: string }}
   */
  async sendMail(to, subject, html) {
    // Respect the global toggle (checked again here for runtime safety)
    if (!env.notifications.emailEnabled) {
      logger.info(`[Email DISABLED] Would send "${subject}" to ${Array.isArray(to) ? to.join(', ') : to}`);
      return { success: false, reason: 'Email notifications disabled' };
    }

    if (!this._transporter || !this._ready) {
      logger.warn(`[Email] Transporter not ready — skipping send of "${subject}"`);
      return { success: false, reason: 'Email transporter not initialised' };
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;

    try {
      const info = await this._transporter.sendMail({
        from: `"${env.smtp.fromName}" <${env.smtp.fromEmail}>`,
        to: recipients,
        subject,
        html,
      });

      logger.info(`[Email] Sent "${subject}" to ${recipients}`, { messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`[Email] Failed to send "${subject}" to ${recipients}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Render an HTML template and send it.
   * @param {string|string[]} to    - Recipient(s)
   * @param {string} templateName   - Key from EMAIL_TEMPLATES (e.g. 'order_confirmed')
   * @param {object} data           - Template variables
   */
  async sendTemplateMail(to, templateName, data = {}) {
    const template = EMAIL_TEMPLATES[templateName];
    if (!template) {
      logger.warn(`[Email] Unknown template: "${templateName}"`);
      return { success: false, reason: `Unknown template: ${templateName}` };
    }

    const subject = template.subject(data);
    const html = template.html(data);
    return this.sendMail(to, subject, html);
  }

  /**
   * Check if the email service is operational.
   */
  isReady() {
    return env.notifications.emailEnabled && this._ready;
  }
}

module.exports = new EmailService();
