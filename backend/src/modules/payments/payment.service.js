const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Order = require('../../models/Order');
const RazorpayWebhookEvent = require('../../models/RazorpayWebhookEvent');
const Cart = require('../../models/Cart');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const logger = require('../../middleware/logger');
const cache = require('../../utils/cache');
const inventoryReservationService = require('../orders/inventoryReservation.service');
const { hasReservableItems } = require('../orders/inventoryReservation.service');
const { cancelUnpaidOnlineOrder } = require('../orders/order.lifecycle');
const couponUsageService = require('../coupons/couponUsage.service');
const loyaltyService = require('../loyalty/loyalty.service');
const operationalAlertService = require('../monitoring/operationalAlert.service');

const CAPTURE_READY_PAYMENT_STATUSES = [
  PAYMENT_STATUSES.CREATED,
  PAYMENT_STATUSES.PENDING,
  PAYMENT_STATUSES.AUTHORIZED,
  PAYMENT_STATUSES.FAILED,
  PAYMENT_STATUSES.EXPIRED,
];

const RECOVERABLE_ORDER_PAYMENT_STATUSES = ['pending', 'failed', 'expired'];
const RECOVERABLE_CANCELLED_NOTES = [
  /^Payment failed/i,
  /^Online payment failed/i,
  /^Online payment expired/i,
];
const WEBHOOK_EVENT_LOCK_MS = 2 * 60 * 1000;

const getWebhookEventExpiresAt = (now = new Date()) => (
  new Date(now.getTime() + env.logging.paymentWebhookEventRetentionDays * 24 * 60 * 60 * 1000)
);

const timingSafeEqualHex = (actual, expected) => {
  if (!actual || !expected || typeof actual !== 'string' || typeof expected !== 'string') return false;

  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

class PaymentService {
  wasOrderAutoCancelledForPayment(order, payment) {
    if (!order || order.status !== ORDER_STATUSES.CANCELLED) return false;

    const hasExplicitCancelEvent = payment?.webhookEvents?.some((entry) => (
      entry.event === 'admin.cancel_unpaid_online_order' ||
      entry.event === 'customer.cancel_unpaid_online_order'
    ));
    if (hasExplicitCancelEvent) return false;

    const hasRecoverablePaymentEvent = payment?.webhookEvents?.some((entry) => (
      entry.event === 'payment.failed' ||
      entry.event === 'order.payment_expired'
    ));

    const latestCancelledHistory = [...(order.statusHistory || [])]
      .reverse()
      .find((entry) => entry.status === ORDER_STATUSES.CANCELLED);
    const cancelledNote = latestCancelledHistory?.note || '';

    return (
      hasRecoverablePaymentEvent &&
      RECOVERABLE_CANCELLED_NOTES.some((pattern) => pattern.test(cancelledNote))
    );
  }

  canFinalizeCapturedOrder(order, payment) {
    if (!order || order.paymentMethod !== 'online') return false;
    if (order.paymentStatus === 'paid') return true;
    if (!RECOVERABLE_ORDER_PAYMENT_STATUSES.includes(order.paymentStatus)) return false;
    if (order.status === ORDER_STATUSES.PENDING) return true;
    return this.wasOrderAutoCancelledForPayment(order, payment);
  }

  async runPostCaptureTasks(order, payment, userId, options = {}) {
    const { clearCart = false, sendNotification = false } = options;

    cache.del('admin:dashboard');

    setImmediate(async () => {
      try {
        if (clearCart && userId) {
          await Cart.findOneAndUpdate(
            { user: userId },
            { items: [], appliedCoupon: null, deliveryNotes: '' }
          );
        }

        const bulkOps = order.items
          .filter((item) => item.product)
          .map((item) => ({
            updateOne: {
              filter: { _id: item.product },
              update: { $inc: { totalOrders: item.quantity } },
            },
          }));
        if (bulkOps.length > 0) {
          await Product.bulkWrite(bulkOps);
        }

        if (sendNotification) {
          const notificationService = require('../notifications/notification.service');
          await notificationService.sendOrderConfirmation(order, payment);
        }
      } catch (asyncErr) {
        logger.warn('Non-critical post-payment task failed:', asyncErr.message);
      }
    });
  }

  async flagCapturedPaymentForManualReview(payment, reason) {
    const order = await Order.findById(payment.order);
    if (!order) return;

    const note = `Payment captured but needs manual review: ${reason}`;
    const alreadyFlagged = [...(order.statusHistory || [])]
      .reverse()
      .some((entry) => entry.note === note);
    if (alreadyFlagged) return;

    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      note,
    });
    await order.save();
    await operationalAlertService.recordPaymentMismatch({
      order,
      payment,
      reason,
      source: 'payment.finalization',
      metadata: {
        paymentRecordStatus: payment.status,
        orderPaymentStatus: order.paymentStatus,
      },
    });
    cache.del('admin:dashboard');
  }

  async confirmCapturedPayment(payment, options = {}) {
    const { userId, note = 'Payment captured', clearCart = false, sendNotification = false } = options;
    const session = await mongoose.startSession();
    let finalized = false;
    let order = null;

    try {
      await session.withTransaction(async () => {
        const currentOrder = await Order.findById(payment.order).session(session);
        if (!currentOrder) throw ApiError.notFound('Order not found for payment', [], 'ORDER_NOT_FOUND');

        if (!this.canFinalizeCapturedOrder(currentOrder, payment)) {
          throw ApiError.badRequest('This order cannot be confirmed automatically. Please contact support.', [], 'ORDER_NOT_CONFIRMABLE');
        }

        if (currentOrder.paymentStatus === 'paid') {
          order = currentOrder;
          await this.markInquiryQuoteConverted(currentOrder, payment, session);
          finalized = false;
          return;
        }

        const currentPayment = await Payment.findOne({
          _id: payment._id,
          status: PAYMENT_STATUSES.CAPTURED,
        }).session(session);
        if (!currentPayment) {
          throw ApiError.badRequest('Payment is not captured yet', [], 'PAYMENT_NOT_CAPTURED');
        }

        await loyaltyService.reapplyRestoredRedemptionForCapture(currentOrder, { session });

        if (hasReservableItems(currentOrder.items)) {
          await inventoryReservationService.confirmForOrder(currentOrder, session);
        }

        if (currentOrder.couponCode) {
          await couponUsageService.consumeForOrder({
            couponCode: currentOrder.couponCode,
            userId: currentOrder.user,
            guestInfo: currentOrder.guestInfo,
            orderId: currentOrder._id,
            session,
          });
        }

        currentOrder.paymentStatus = 'paid';
        currentOrder.status = ORDER_STATUSES.CONFIRMED;
        currentOrder.statusHistory.push({
          status: ORDER_STATUSES.CONFIRMED,
          timestamp: new Date(),
          note,
        });

        order = await currentOrder.save({ session });
        await this.markInquiryQuoteConverted(currentOrder, currentPayment, session);
        finalized = true;
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode < 500) {
        await this.flagCapturedPaymentForManualReview(payment, error.message);
      }
      throw error;
    } finally {
      session.endSession();
    }

    if (finalized) {
      await this.runPostCaptureTasks(order, payment, userId, { clearCart, sendNotification });
    }

    return { order, finalized };
  }

  async markInquiryQuoteConverted(order, payment, session) {
    if (!order || order.source !== 'inquiry' || !order.sourceQuote || !order.sourceInquiry) return;

    const InquiryQuote = require('../../models/InquiryQuote');
    const CustomCakeInquiry = require('../../models/CustomCakeInquiry');
    const CorporateInquiry = require('../../models/CorporateInquiry');
    const { INQUIRY_QUOTE_STATUSES, INQUIRY_STATUSES } = require('../../utils/constants');

    const convertedAt = new Date();
    await InquiryQuote.updateOne(
      { _id: order.sourceQuote },
      {
        $set: {
          status: INQUIRY_QUOTE_STATUSES.CONVERTED,
          convertedAt,
          order: order._id,
          payment: payment._id,
        },
      },
      { session }
    );

    const InquiryModel = order.sourceInquiryType === 'corporate'
      ? CorporateInquiry
      : CustomCakeInquiry;

    await InquiryModel.updateOne(
      { _id: order.sourceInquiry },
      {
        $set: {
          status: INQUIRY_STATUSES.CONFIRMED,
          quoteStatus: INQUIRY_QUOTE_STATUSES.CONVERTED,
          convertedOrder: order._id,
          convertedAt,
        },
      },
      { session }
    );
  }

  /**
   * Defense-in-depth: the amount captured at the provider must equal the amount
   * we created the order/payment with. Razorpay already enforces the order amount
   * at capture, so this guards against partial-payment misconfig or tampering.
   * Only a definite mismatch fails; a missing provider amount proceeds.
   */
  capturedAmountMatches(payment, providerAmount, providerCurrency) {
    if (providerAmount === undefined || providerAmount === null || providerAmount === '') return true;

    const expected = Number(payment?.amount);
    const actual = Number(providerAmount);
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) return true;
    if (actual !== expected) return false;

    if (
      providerCurrency &&
      payment?.currency &&
      String(providerCurrency).toUpperCase() !== String(payment.currency).toUpperCase()
    ) {
      return false;
    }

    return true;
  }

  verifySignature(payload, signature, secret, failureMessage) {
    if (!secret) {
      throw ApiError.badRequest(failureMessage, [], 'INVALID_SIGNATURE');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (!timingSafeEqualHex(signature, expectedSignature)) {
      throw ApiError.badRequest(failureMessage, [], 'INVALID_SIGNATURE');
    }
  }

  buildPaymentVerifyResponse(order, payment) {
    return {
      success: true,
      orderNumber: order?.orderNumber,
      paymentId: payment?.razorpayPaymentId,
    };
  }

  /**
   * Verify Razorpay payment signature (client-side verification)
   */
  async verifyPayment(userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    this.verifySignature(body, razorpaySignature, env.razorpay.keySecret, 'Payment verification failed - invalid signature');

    const payment = await Payment.findOneAndUpdate(
      {
        razorpayOrderId,
        user: userId,
        $or: [
          { status: { $in: CAPTURE_READY_PAYMENT_STATUSES } },
          { status: PAYMENT_STATUSES.CAPTURED, razorpayPaymentId },
        ],
      },
      {
        $set: {
          razorpayPaymentId,
          razorpaySignature,
          status: PAYMENT_STATUSES.CAPTURED,
        },
      },
      { new: true }
    );

    // If no active payment was found, allow only true idempotent captured returns.
    if (!payment) {
      const existingPayment = await Payment.findOne({ razorpayOrderId, user: userId });
      if (!existingPayment) throw ApiError.notFound('Payment record not found', [], 'PAYMENT_NOT_FOUND');

      const existingOrder = await Order.findById(existingPayment.order).lean();
      if (existingPayment.status !== PAYMENT_STATUSES.CAPTURED || existingOrder?.paymentStatus !== 'paid') {
        throw ApiError.badRequest('This payment session is no longer active. Please start checkout again.', [], 'PAYMENT_SESSION_INACTIVE');
      }

      logger.info(`Payment already captured for order ${existingOrder?.orderNumber} (idempotent return)`);
      return this.buildPaymentVerifyResponse(existingOrder, existingPayment);
    }

    const order = await Order.findOne({ _id: payment.order, user: userId, paymentMethod: 'online' });
    if (!order) throw ApiError.notFound('Order not found for payment', [], 'ORDER_NOT_FOUND');

    const finalized = await this.confirmCapturedPayment(payment, {
      userId,
      note: 'Payment verified',
      clearCart: true,
      sendNotification: true,
    });

    return this.buildPaymentVerifyResponse(finalized.order, payment);
  }

  buildWebhookEventId(event, eventType) {
    const paymentEntity = event?.payload?.payment?.entity || {};
    const orderId = paymentEntity.order_id || '';
    const paymentId = paymentEntity.id || '';

    if (event?.id) return event.id;
    if (paymentId) return `${eventType}:${paymentId}`;
    if (orderId) return `${eventType}:${orderId}`;

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex');
  }

  async acquireWebhookEvent(event, eventType) {
    const paymentEntity = event?.payload?.payment?.entity || {};
    const eventId = this.buildWebhookEventId(event, eventType);
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + WEBHOOK_EVENT_LOCK_MS);
    const expiresAt = getWebhookEventExpiresAt(now);

    try {
      const record = await RazorpayWebhookEvent.create({
        eventId,
        eventType,
        razorpayOrderId: paymentEntity.order_id || '',
        razorpayPaymentId: paymentEntity.id || '',
        status: 'processing',
        payload: event,
        lockedUntil,
        expiresAt,
      });

      return { eventId, record, shouldProcess: true };
    } catch (error) {
      if (error.code !== 11000) throw error;

      const record = await RazorpayWebhookEvent.findOne({ eventId });
      if (!record) {
        throw ApiError.conflict('Webhook event is already being processed', [], 'WEBHOOK_EVENT_IN_PROGRESS');
      }

      if (record.status === 'completed') {
        return { eventId, record, shouldProcess: false };
      }

      if (record.status === 'processing' && record.lockedUntil > now) {
        return { eventId, record, shouldProcess: false };
      }

      const locked = await RazorpayWebhookEvent.findOneAndUpdate(
        {
          eventId,
          $or: [
            { status: 'failed' },
            { lockedUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            status: 'processing',
            payload: event,
            lockedUntil,
            lastError: '',
            expiresAt,
          },
          $inc: { attempts: 1 },
        },
        { new: true }
      );

      return { eventId, record: locked || record, shouldProcess: Boolean(locked) };
    }
  }

  async completeWebhookEvent(eventId) {
    await RazorpayWebhookEvent.findOneAndUpdate(
      { eventId },
      {
        $set: {
          status: 'completed',
          lockedUntil: new Date(),
          processedAt: new Date(),
          lastError: '',
        },
      }
    );
  }

  async failWebhookEvent(eventId, error) {
    await RazorpayWebhookEvent.findOneAndUpdate(
      { eventId },
      {
        $set: {
          status: 'failed',
          lockedUntil: new Date(),
          lastError: error.message || 'Webhook processing failed',
        },
      }
    );
  }

  async recordPaymentWebhookEvent(paymentId, eventId, eventType, payload, session = null) {
    if (!paymentId) return;

    await Payment.updateOne(
      {
        _id: paymentId,
        'webhookEvents.eventId': { $ne: eventId },
      },
      {
        $push: {
          webhookEvents: {
            $each: [{
              eventId,
              event: eventType,
              payload,
              receivedAt: new Date(),
            }],
            $slice: -env.logging.paymentEmbeddedWebhookEventLimit,
          },
        },
      },
      { session }
    );
  }

  async handleCapturedWebhook(eventType, eventId, paymentEntity) {
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    const payment = await Payment.findOneAndUpdate(
      {
        razorpayOrderId,
        $or: [
          { status: { $in: CAPTURE_READY_PAYMENT_STATUSES } },
          { status: PAYMENT_STATUSES.CAPTURED, razorpayPaymentId },
        ],
      },
      {
        $set: {
          razorpayPaymentId,
          status: PAYMENT_STATUSES.CAPTURED,
          method: paymentEntity.method || 'online',
        },
      },
      { new: true }
    );

    if (!payment) {
      logger.info(`Webhook skipped - payment ${razorpayPaymentId} was not found or is not capturable`);
      return;
    }

    await this.recordPaymentWebhookEvent(payment._id, eventId, eventType, paymentEntity);

    if (!this.capturedAmountMatches(payment, paymentEntity.amount, paymentEntity.currency)) {
      logger.error(`[Payment] Captured amount mismatch for ${razorpayOrderId}: expected ${payment.amount} ${payment.currency}, got ${paymentEntity.amount} ${paymentEntity.currency || ''}`);
      await this.flagCapturedPaymentForManualReview(
        payment,
        `Captured amount ${paymentEntity.amount} ${paymentEntity.currency || ''} does not match expected ${payment.amount} ${payment.currency}`
      );
      return;
    }

    try {
      await this.confirmCapturedPayment(payment, {
        userId: payment.user,
        note: 'Payment confirmed via webhook',
        clearCart: true,
        sendNotification: true,
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode < 500) {
        logger.error(`[Payment] Captured webhook needs manual review for ${razorpayOrderId}: ${error.message}`);
        return;
      }
      throw error;
    }
  }

  async handleFailedWebhook(eventType, eventId, paymentEntity) {
    const razorpayOrderId = paymentEntity.order_id;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const payment = await Payment.findOne({ razorpayOrderId }).session(session);
        if (!payment) return;

        const order = await Order.findById(payment.order).session(session);
        if (!order) return;

        await cancelUnpaidOnlineOrder(order, {
          session,
          paymentStatus: 'failed',
          paymentRecordStatus: PAYMENT_STATUSES.FAILED,
          note: 'Online payment failed',
          paymentEvent: eventType,
          paymentPayload: paymentEntity,
          paymentEventId: eventId,
          razorpayPaymentId: paymentEntity.id,
          paymentMethod: paymentEntity.method || 'online',
        });
      });
    } finally {
      session.endSession();
    }
  }

  async reconcileCapturedProviderPayment(payment, providerPayment = {}) {
    const razorpayPaymentId = providerPayment.id || payment.razorpayPaymentId || '';
    const paymentRecord = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        $or: [
          { status: { $in: CAPTURE_READY_PAYMENT_STATUSES } },
          { status: PAYMENT_STATUSES.CAPTURED, razorpayPaymentId },
        ],
      },
      {
        $set: {
          razorpayPaymentId,
          status: PAYMENT_STATUSES.CAPTURED,
          method: providerPayment.method || payment.method || 'online',
        },
      },
      { new: true }
    );

    if (!paymentRecord) {
      return { repaired: false, reason: 'not_capturable' };
    }

    if (!this.capturedAmountMatches(paymentRecord, providerPayment.amount, providerPayment.currency)) {
      logger.error(`[Payment] Reconciled amount mismatch for ${paymentRecord.razorpayOrderId}: expected ${paymentRecord.amount} ${paymentRecord.currency}, got ${providerPayment.amount} ${providerPayment.currency || ''}`);
      await this.flagCapturedPaymentForManualReview(
        paymentRecord,
        `Reconciled captured amount ${providerPayment.amount} ${providerPayment.currency || ''} does not match expected ${paymentRecord.amount} ${paymentRecord.currency}`
      );
      return { repaired: false, reason: 'amount_mismatch' };
    }

    await this.recordPaymentWebhookEvent(
      paymentRecord._id,
      `reconciliation:${razorpayPaymentId || paymentRecord.razorpayOrderId}`,
      'payment.reconciled_captured',
      providerPayment
    );

    const result = await this.confirmCapturedPayment(paymentRecord, {
      userId: paymentRecord.user,
      note: 'Payment reconciled from Razorpay',
      clearCart: true,
      sendNotification: true,
    });

    return {
      repaired: result.finalized,
      orderNumber: result.order?.orderNumber,
      reason: result.finalized ? 'captured_reconciled' : 'already_paid',
    };
  }

  /**
   * Handle Razorpay webhook (server-side backup)
   */
  async handleWebhook(rawBody, signature) {
    this.verifySignature(rawBody, signature, env.razorpay.webhookSecret, 'Invalid webhook signature');

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const { eventId, shouldProcess } = await this.acquireWebhookEvent(event, eventType);

    if (!shouldProcess) {
      logger.info(`Razorpay webhook duplicate skipped: ${eventType} (${eventId})`);
      return { status: 'duplicate' };
    }

    logger.info(`Razorpay webhook received: ${eventType}`);

    try {
      switch (eventType) {
        case 'payment.captured': {
          const paymentEntity = event.payload.payment.entity;
          await this.handleCapturedWebhook(eventType, eventId, paymentEntity);
          break;
        }

        case 'payment.failed': {
          const paymentEntity = event.payload.payment.entity;
          await this.handleFailedWebhook(eventType, eventId, paymentEntity);
          break;
        }

        default:
          logger.info(`Unhandled webhook event: ${eventType}`);
      }

      await this.completeWebhookEvent(eventId);
    } catch (error) {
      await this.failWebhookEvent(eventId, error).catch((failError) => {
        logger.warn(`[Payment] Failed to persist webhook failure for ${eventId}: ${failError.message}`);
      });
      throw error;
    }

    return { status: 'processed' };
  }

  /**
   * Decrement stock for order items (online payments)
   */
  async decrementStock(order) {
    const bulkOps = order.items
      .filter((item) => item.product)
      .map((item) => ({
        updateOne: {
          filter: { product: item.product, weight: item.weight, stock: { $gte: item.quantity } },
          update: { $inc: { stock: -item.quantity } },
        },
      }));

    if (bulkOps.length > 0) {
      const result = await Variant.bulkWrite(bulkOps);
      const notUpdated = bulkOps.length - result.modifiedCount;
      if (notUpdated > 0) {
        logger.warn(`[Payment] ${notUpdated} item(s) had insufficient stock during order ${order.orderNumber} - stock guard prevented decrement`);
      }
    }
  }

  /**
   * Record coupon usage after successful payment
   */
  async recordCouponUsage(order) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await couponUsageService.consumeForOrder({
          couponCode: order.couponCode,
          userId: order.user,
          guestInfo: order.guestInfo,
          orderId: order._id,
          session,
        });
      });
    } finally {
      session.endSession();
    }
  }
}

module.exports = new PaymentService();
