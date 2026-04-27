'use strict';

const NotificationLog = require('../../models/NotificationLog');
const whatsappService = require('./whatsapp.service');
const emailService = require('./email.service');
const WA_TEMPLATES = require('./notification.templates');
const logger = require('../../middleware/logger');
const { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } = require('../../utils/constants');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { env } = require('../../config/env');

class NotificationService {

  // ───────────────────────────────────────────────────────────────────────────
  // Internal: log a notification result to the database
  // ───────────────────────────────────────────────────────────────────────────
  async _log({ userId, channel, type, recipient, templateName, result }) {
    try {
      await NotificationLog.create({
        user: userId || null,
        channel,
        type,
        recipient,
        templateName: templateName || '',
        status: result.success ? 'sent' : 'failed',
        externalId: result.messageId || '',
        errorMessage: result.error || result.reason || '',
        sentAt: new Date(),
      });
    } catch (logErr) {
      logger.warn('[NotificationLog] Failed to write log entry:', logErr.message);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal: send via WhatsApp and log
  // ───────────────────────────────────────────────────────────────────────────
  async _sendWhatsApp({ userId, type, phone, templateKey, templateParams }) {
    if (!env.notifications.whatsappEnabled) return;
    if (!phone) return;

    const result = await whatsappService.sendTemplateMessage(phone, templateKey, templateParams);
    await this._log({
      userId,
      channel: NOTIFICATION_CHANNELS.WHATSAPP,
      type,
      recipient: phone,
      templateName: templateKey,
      templateParams,
      result,
    });
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal: send via Email and log
  // ───────────────────────────────────────────────────────────────────────────
  async _sendEmail({ userId, type, email, templateKey, templateData }) {
    if (!env.notifications.emailEnabled) return;
    if (!email) return;

    const result = await emailService.sendTemplateMail(email, templateKey, templateData);
    await this._log({
      userId,
      channel: NOTIFICATION_CHANNELS.EMAIL,
      type,
      recipient: Array.isArray(email) ? email.join(', ') : email,
      templateName: templateKey,
      templateParams: templateData,
      result,
    });
    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal: fan-out to enabled channels for order notifications
  // ───────────────────────────────────────────────────────────────────────────
  async _fanOut({ userId, type, phone, email,
                  waTemplateKey, waParams,
                  emailTemplateKey, emailData }) {
    const tasks = [];

    if (env.notifications.whatsappEnabled && phone && waTemplateKey) {
      tasks.push(this._sendWhatsApp({ userId, type, phone, templateKey: waTemplateKey, templateParams: waParams }));
    }

    if (env.notifications.emailEnabled && email && emailTemplateKey) {
      tasks.push(this._sendEmail({ userId, type, email, templateKey: emailTemplateKey, templateData: emailData }));
    }

    if (tasks.length === 0) {
      logger.info(`[Notification] Both channels disabled — skipped "${type}" for ${email || phone || 'unknown'}`);
      return;
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.warn(`[Notification] Channel send failed (task ${i}):`, r.reason?.message || r.reason);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER RESOLVERS — support both registered users and guests
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve the customer email from an order.
   *
   * Handles all three cases:
   *   1. Populated user object  → order.user.email   (inline, no DB call)
   *   2. Unpopulated ObjectId   → fetches User from DB (occurs in payment.service, updateOrderStatus)
   *   3. Guest order (no user)  → order.guestInfo.email
   *
   * @returns {Promise<string|null>}
   */
  async _resolveOrderEmail(order) {
    // Case 1: user is already populated with email
    if (order.user && typeof order.user === 'object' && order.user.email) {
      return order.user.email;
    }

    // Case 2: user is an ObjectId — fetch email from DB
    // (happens when order is fetched without .populate('user'))
    if (order.user && typeof order.user !== 'object') {
      // order.user is an ObjectId (primitive-like from mongoose)
      try {
        const User = require('../../models/User');
        const user = await User.findById(order.user).select('email').lean();
        if (user?.email) return user.email;
      } catch (e) {
        logger.warn('[Notification] Failed to fetch user email for order', order.orderNumber, e.message);
      }
    }

    // ObjectId case via mongoose — typeof is 'object' but no .email property
    if (order.user && typeof order.user === 'object' && !order.user.email && order.user._id) {
      try {
        const User = require('../../models/User');
        const user = await User.findById(order.user._id).select('email').lean();
        if (user?.email) return user.email;
      } catch (e) {
        logger.warn('[Notification] Failed to fetch user email (ObjectId) for order', order.orderNumber, e.message);
      }
    }

    // Case 3: guest order
    if (order.guestInfo?.email) return order.guestInfo.email;

    return null;
  }

  _resolveOrderPhone(order) {
    return order.shippingAddress?.phone || order.guestInfo?.phone || null;
  }

  _resolveOrderUserId(order) {
    if (!order.user) return null;
    if (typeof order.user === 'object') return order.user._id || order.user;
    return order.user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Order Confirmation — sent for both COD and online-paid orders.
   * WhatsApp: order_confirmed + order_details (2s later)
   * Email:    order_confirmed + order_details (3s later)
   */
  async sendOrderConfirmation(order, payment = null) {
    const userId      = this._resolveOrderUserId(order);
    const email       = await this._resolveOrderEmail(order);
    const phone       = this._resolveOrderPhone(order);
    const customerName = order.shippingAddress?.fullName || order.guestInfo?.name || 'Customer';

    // ── WhatsApp ──
    if (env.notifications.whatsappEnabled && phone) {
      const waConfirmedParams = WA_TEMPLATES.order_confirmed.buildParams(order, payment);
      await this._sendWhatsApp({
        userId, type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
        phone, templateKey: 'order_confirmed', templateParams: waConfirmedParams,
      });

      setTimeout(async () => {
        try {
          const waDetailsParams = WA_TEMPLATES.order_details.buildParams(order);
          await this._sendWhatsApp({
            userId, type: NOTIFICATION_TYPES.ORDER_DETAILS,
            phone, templateKey: 'order_details', templateParams: waDetailsParams,
          });
        } catch (e) {
          logger.warn('[Notification] WhatsApp order_details delayed send failed:', e.message);
        }
      }, 2000);
    }

    // ── Email ──
    if (env.notifications.emailEnabled && email) {
      const emailData = {
        customerName,
        orderNumber:   order.orderNumber,
        deliveryDate:  new Date(order.deliveryDate).toLocaleDateString('en-IN'),
        deliverySlot:  order.deliverySlot?.label || 'Standard',
        itemCount:     order.items.length.toString(),
        paymentMethod: order.paymentMethod || 'cod',
        total:         `₹${(order.total / 100).toFixed(2)}`,
      };
      await this._sendEmail({
        userId, type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
        email, templateKey: 'order_confirmed', templateData: emailData,
      });

      // Follow-up itemised breakdown (3s delay)
      setTimeout(async () => {
        try {
          const itemsList = order.items
            .map((item) => `${item.name} (${item.weight || ''}) x${item.quantity}`)
            .join(', ');
          const detailsData = {
            orderNumber:    order.orderNumber,
            items:          itemsList,
            subtotal:       `₹${(order.subtotal / 100).toFixed(2)}`,
            deliveryCharge: `₹${(order.deliveryCharge / 100).toFixed(2)}`,
            discount:       `₹${((order.discount || 0) / 100).toFixed(2)}`,
            total:          `₹${(order.total / 100).toFixed(2)}`,
            address:        `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city} - ${order.shippingAddress.pincode}`,
            deliveryDate:   new Date(order.deliveryDate).toLocaleDateString('en-IN'),
            deliverySlot:   order.deliverySlot?.label || 'Standard',
          };
          await this._sendEmail({
            userId, type: NOTIFICATION_TYPES.ORDER_DETAILS,
            email, templateKey: 'order_details', templateData: detailsData,
          });
        } catch (e) {
          logger.warn('[Notification] Email order_details delayed send failed:', e.message);
        }
      }, 3000);
    }
  }

  /**
   * Payment Success
   */
  async sendPaymentSuccess(order, payment) {
    const userId       = this._resolveOrderUserId(order);
    const email        = await this._resolveOrderEmail(order);
    const phone        = this._resolveOrderPhone(order);
    const customerName = order.shippingAddress?.fullName || 'Customer';

    const waParams = WA_TEMPLATES.payment_success.buildParams(order, payment);
    const emailData = {
      customerName,
      orderNumber: order.orderNumber,
      amount:      (order.total / 100).toFixed(2),
      paymentId:   payment?.razorpayPaymentId || '',
      method:      payment?.method || 'Online',
    };

    return this._fanOut({
      userId, type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      phone, email,
      waTemplateKey: 'payment_success', waParams,
      emailTemplateKey: 'payment_success', emailData,
    });
  }

  /**
   * Payment Failed
   */
  async sendPaymentFailed(order) {
    const userId       = this._resolveOrderUserId(order);
    const email        = await this._resolveOrderEmail(order);
    const phone        = this._resolveOrderPhone(order);
    const customerName = order.shippingAddress?.fullName || 'Customer';

    const waParams = WA_TEMPLATES.payment_failed.buildParams(order);
    const emailData = {
      customerName,
      orderNumber: order.orderNumber,
      amount:      (order.total / 100).toFixed(2),
    };

    return this._fanOut({
      userId, type: NOTIFICATION_TYPES.PAYMENT_FAILED,
      phone, email,
      waTemplateKey: 'payment_failed', waParams,
      emailTemplateKey: 'payment_failed', emailData,
    });
  }

  /**
   * Order Status Update — triggered by admin changing order status
   */
  async sendStatusUpdate(order, newStatus) {
    const statusMap = {
      preparing:        { type: NOTIFICATION_TYPES.ORDER_PREPARING, tpl: 'order_preparing' },
      packed:           { type: NOTIFICATION_TYPES.ORDER_PACKED,     tpl: 'order_packed' },
      dispatched:       { type: NOTIFICATION_TYPES.ORDER_DISPATCHED, tpl: 'order_dispatched' },
      out_for_delivery: { type: NOTIFICATION_TYPES.OUT_FOR_DELIVERY,  tpl: 'out_for_delivery' },
      delivered:        { type: NOTIFICATION_TYPES.ORDER_DELIVERED,  tpl: 'order_delivered' },
      cancelled:        { type: NOTIFICATION_TYPES.ORDER_CANCELLED,  tpl: 'order_cancelled' },
    };

    const entry = statusMap[newStatus];
    if (!entry) return;

    const userId       = this._resolveOrderUserId(order);
    const email        = await this._resolveOrderEmail(order);
    const phone        = this._resolveOrderPhone(order);
    const customerName = order.shippingAddress?.fullName || 'Customer';

    const waTemplate = WA_TEMPLATES[entry.tpl];
    const waParams   = waTemplate ? waTemplate.buildParams(order) : {};

    const emailData = {
      customerName,
      orderNumber:  order.orderNumber,
      deliverySlot: order.deliverySlot?.label || 'Today',
      reason:       'As per your request',
    };

    return this._fanOut({
      userId, type: entry.type,
      phone, email,
      waTemplateKey:    entry.tpl, waParams,
      emailTemplateKey: entry.tpl, emailData,
    });
  }

  /**
   * Welcome notification — sent on new user registration
   */
  async sendWelcomeNotification(user) {
    const tasks = [];

    if (env.notifications.emailEnabled && user.email) {
      tasks.push(
        this._sendEmail({
          userId:       user._id,
          type:         NOTIFICATION_TYPES.WELCOME,
          email:        user.email,
          templateKey:  'welcome',
          templateData: { name: user.name },
        })
      );
    }

    if (env.notifications.whatsappEnabled && user.phone) {
      const waParams = WA_TEMPLATES.welcome.buildParams(user);
      tasks.push(
        this._sendWhatsApp({
          userId:        user._id,
          type:          NOTIFICATION_TYPES.WELCOME,
          phone:         user.phone,
          templateKey:   'welcome',
          templateParams: waParams,
        })
      );
    }

    if (tasks.length === 0) {
      logger.info(`[Notification] Channels disabled — welcome skipped for ${user.email}`);
      return;
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.warn(`[Notification] Welcome send failed (task ${i}):`, r.reason?.message);
      }
    });
  }

  /**
   * Password Reset — email only (security-sensitive, never WhatsApp)
   */
  async sendPasswordResetEmail(user, resetUrl) {
    if (!env.notifications.emailEnabled) {
      logger.info(`[Email DISABLED] Password reset email skipped for ${user.email}`);
      return;
    }
    if (!user.email) {
      logger.warn('[Notification] sendPasswordResetEmail: user has no email');
      return;
    }

    return this._sendEmail({
      userId:       user._id,
      type:         NOTIFICATION_TYPES.PASSWORD_RESET,
      email:        user.email,
      templateKey:  'password_reset',
      templateData: { name: user.name, resetUrl },
    });
  }

  /**
   * Inquiry Alert — sent to all admin alert emails when a new inquiry is submitted
   * @param {object} inquiry         — The saved inquiry document
   * @param {'custom_cake'|'corporate'} inquiryType
   */
  async sendInquiryAlert(inquiry, inquiryType = 'custom_cake') {
    const adminEmails = env.adminAlertEmails;
    const typeLabel   = inquiryType === 'corporate' ? 'Corporate' : 'Custom Cake';

    const emailData = {
      inquiryType:    typeLabel,
      customerName:   inquiry.name  || inquiry.contactName  || 'N/A',
      customerEmail:  inquiry.email || inquiry.contactEmail || 'N/A',
      customerPhone:  inquiry.phone || inquiry.contactPhone || 'N/A',
      occasion:       inquiry.occasion    || '',
      budget:         inquiry.budget      || '',
      companyName:    inquiry.companyName || '',
      quantity:       inquiry.quantity ? String(inquiry.quantity) : '',
      message:        inquiry.description || inquiry.requirements || inquiry.message || '',
    };

    if (env.notifications.emailEnabled && adminEmails.length > 0) {
      await this._sendEmail({
        userId:       null,
        type:         NOTIFICATION_TYPES.INQUIRY_ALERT,
        email:        adminEmails,
        templateKey:  'inquiry_alert',
        templateData: emailData,
      });
    } else {
      logger.info('[Notification] Email disabled or no admin emails — inquiry alert skipped');
    }
    // WhatsApp admin alert: extend here by adding ADMIN_WHATSAPP_NUMBER to .env when needed
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READ / ADMIN QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  async getUserNotifications(userId, query) {
    const { page, limit, skip } = parsePagination(query);
    const [notifications, total] = await Promise.all([
      NotificationLog.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationLog.countDocuments({ user: userId }),
    ]);
    return paginatedResponse(notifications, total, page, limit);
  }

  async adminGetNotifications(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.channel) filter.channel = query.channel;
    if (query.type)    filter.type    = query.type;
    if (query.status)  filter.status  = query.status;

    const [notifications, total] = await Promise.all([
      NotificationLog.find(filter)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationLog.countDocuments(filter),
    ]);
    return paginatedResponse(notifications, total, page, limit);
  }
}

module.exports = new NotificationService();
