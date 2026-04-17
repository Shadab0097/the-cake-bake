const NotificationLog = require('../../models/NotificationLog');
const whatsappService = require('./whatsapp.service');
const TEMPLATES = require('./notification.templates');
const logger = require('../../middleware/logger');
const { NOTIFICATION_CHANNELS } = require('../../utils/constants');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

class NotificationService {
  /**
   * Send an order-related WhatsApp notification
   */
  async sendOrderNotification(notificationType, order, payment = null) {
    const template = TEMPLATES[notificationType];
    if (!template) {
      logger.warn(`Unknown notification type: ${notificationType}`);
      return;
    }

    const recipientPhone = order.shippingAddress?.phone;
    if (!recipientPhone) {
      logger.warn(`No phone number for order ${order.orderNumber}`);
      return;
    }

    const params = template.buildParams(order, payment);

    // Send via WhatsApp
    const result = await whatsappService.sendTemplateMessage(
      recipientPhone,
      template.name,
      params
    );

    // Log the notification
    await NotificationLog.create({
      user: order.user,
      channel: NOTIFICATION_CHANNELS.WHATSAPP,
      type: notificationType,
      recipient: recipientPhone,
      templateName: template.name,
      templateParams: params,
      status: result.success ? 'sent' : 'failed',
      externalId: result.messageId || '',
      errorMessage: result.error || '',
      sentAt: new Date(),
    });

    return result;
  }

  /**
   * Send order confirmed + order details notifications
   */
  async sendOrderConfirmation(order, payment) {
    await this.sendOrderNotification('order_confirmed', order, payment);
    // Slight delay for order details
    setTimeout(() => {
      this.sendOrderNotification('order_details', order);
    }, 2000);
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccess(order, payment) {
    return this.sendOrderNotification('payment_success', order, payment);
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(order) {
    return this.sendOrderNotification('payment_failed', order);
  }

  /**
   * Send status change notification
   */
  async sendStatusUpdate(order, newStatus) {
    const statusToTemplate = {
      preparing: 'order_preparing',
      packed: 'order_packed',
      dispatched: 'order_dispatched',
      out_for_delivery: 'out_for_delivery',
      delivered: 'order_delivered',
      cancelled: 'order_cancelled',
    };

    const templateKey = statusToTemplate[newStatus];
    if (templateKey) {
      return this.sendOrderNotification(templateKey, order);
    }
  }

  /**
   * Get notification history for a user
   */
  async getUserNotifications(userId, query) {
    const { page, limit, skip } = parsePagination(query);

    const [notifications, total] = await Promise.all([
      NotificationLog.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationLog.countDocuments({ user: userId }),
    ]);

    return paginatedResponse(notifications, total, page, limit);
  }

  /**
   * Admin: Get all notification logs
   */
  async adminGetNotifications(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.channel) filter.channel = query.channel;
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

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
