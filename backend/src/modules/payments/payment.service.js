const crypto = require('crypto');
const Payment = require('../../models/Payment');
const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const User = require('../../models/User');
const LoyaltyPoints = require('../../models/LoyaltyPoints');
const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const logger = require('../../middleware/logger');
const cache = require('../../utils/cache');

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

  async reapplyRedeemedPointsIfRestored(order) {
    if (!order.user || !order.pointsRedeemed || order.pointsRedeemed <= 0) return;

    const restored = await LoyaltyPoints.findOne({
      user: order.user,
      referenceId: order._id,
      type: 'adjusted',
      points: order.pointsRedeemed,
      description: /^Refunded /,
    }).lean();

    if (!restored) return;

    const alreadyReapplied = await LoyaltyPoints.findOne({
      user: order.user,
      referenceId: order._id,
      type: 'adjusted',
      points: -order.pointsRedeemed,
      description: /^Re-applied /,
    }).lean();

    if (alreadyReapplied) return;

    await User.findByIdAndUpdate(order.user, { $inc: { loyaltyPoints: -order.pointsRedeemed } });
    await LoyaltyPoints.create({
      user: order.user,
      type: 'adjusted',
      points: -order.pointsRedeemed,
      source: 'order',
      referenceId: order._id,
      description: `Re-applied ${order.pointsRedeemed} points after captured payment for order ${order.orderNumber}`,
    });
  }

  async runPostCaptureTasks(order, payment, userId, options = {}) {
    const { clearCart = false, sendNotification = false } = options;

    await this.decrementStock(order);

    if (order.couponCode) {
      await this.recordCouponUsage(order);
    }

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
    cache.del('admin:dashboard');
  }

  async confirmCapturedPayment(payment, options = {}) {
    const { userId, note = 'Payment captured', clearCart = false, sendNotification = false } = options;

    const currentOrder = await Order.findById(payment.order);
    if (!currentOrder) throw ApiError.notFound('Order not found for payment');

    if (!this.canFinalizeCapturedOrder(currentOrder, payment)) {
      await this.flagCapturedPaymentForManualReview(payment, 'order is not in a recoverable payment state');
      throw ApiError.badRequest('This order cannot be confirmed automatically. Please contact support.');
    }

    if (currentOrder.paymentStatus === 'paid') {
      return { order: currentOrder, finalized: false };
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: currentOrder._id,
        paymentMethod: 'online',
        paymentStatus: currentOrder.paymentStatus,
        status: currentOrder.status,
        updatedAt: currentOrder.updatedAt,
      },
      {
        $set: {
          paymentStatus: 'paid',
          status: ORDER_STATUSES.CONFIRMED,
        },
        $push: {
          statusHistory: {
            status: ORDER_STATUSES.CONFIRMED,
            timestamp: new Date(),
            note,
          },
        },
      },
      { new: true }
    );

    if (!order) {
      const existingOrder = await Order.findById(payment.order).lean();
      if (existingOrder?.paymentStatus === 'paid') {
        return { order: existingOrder, finalized: false };
      }

      await this.flagCapturedPaymentForManualReview(payment, 'order changed before confirmation');
      throw ApiError.badRequest('This payment was captured but the order changed before confirmation. Please contact support.');
    }

    try {
      await this.reapplyRedeemedPointsIfRestored(order);
    } catch (pointsErr) {
      logger.warn(`[Payment] Loyalty points re-apply failed for ${order.orderNumber}: ${pointsErr.message}`);
    }

    await this.runPostCaptureTasks(order, payment, userId, { clearCart, sendNotification });
    return { order, finalized: true };
  }

  /**
   * Verify Razorpay payment signature (client-side verification)
   */
  async verifyPayment(userId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    // Verify signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw ApiError.badRequest('Payment verification failed - invalid signature');
    }

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
      if (!existingPayment) throw ApiError.notFound('Payment record not found');

      const existingOrder = await Order.findById(existingPayment.order).lean();
      if (existingPayment.status !== PAYMENT_STATUSES.CAPTURED || existingOrder?.paymentStatus !== 'paid') {
        throw ApiError.badRequest('This payment session is no longer active. Please start checkout again.');
      }

      logger.info(`Payment already captured for order ${existingOrder?.orderNumber} (idempotent return)`);
      return {
        success: true,
        orderNumber: existingOrder?.orderNumber,
        paymentId: existingPayment.razorpayPaymentId,
      };
    }

    // Update order - critical path.
    const order = await Order.findOne({ _id: payment.order, user: userId, paymentMethod: 'online' });
    if (!order) throw ApiError.notFound('Order not found for payment');

    const finalized = await this.confirmCapturedPayment(payment, {
      userId,
      note: 'Payment verified',
      clearCart: true,
      sendNotification: true,
    });

    return {
      success: true,
      orderNumber: finalized.order?.orderNumber,
      paymentId: razorpayPaymentId,
    };
  }

  /**
   * Handle Razorpay webhook (server-side backup)
   */
  async handleWebhook(rawBody, signature) {
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', env.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw ApiError.badRequest('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    logger.info(`Razorpay webhook received: ${eventType}`);

    switch (eventType) {
      case 'payment.captured': {
        const paymentEntity = event.payload.payment.entity;
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
            $push: {
              webhookEvents: {
                event: eventType,
                payload: paymentEntity,
                receivedAt: new Date(),
              },
            },
          },
          { new: true }
        );

        if (!payment) {
          logger.info(`Webhook skipped - payment ${razorpayPaymentId} was not found or is not capturable`);
          break;
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
            break;
          }
          throw error;
        }
        break;
      }

      case 'payment.failed': {
        const paymentEntity = event.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        await Payment.findOneAndUpdate(
          {
            razorpayOrderId,
            status: { $in: CAPTURE_READY_PAYMENT_STATUSES },
          },
          {
            $set: {
              razorpayPaymentId: paymentEntity.id,
              ...(paymentEntity.method ? { method: paymentEntity.method } : {}),
            },
            $push: {
              webhookEvents: {
                event: eventType,
                payload: paymentEntity,
                receivedAt: new Date(),
              },
            },
          }
        );
        break;
      }

      default:
        logger.info(`Unhandled webhook event: ${eventType}`);
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
    const coupon = await Coupon.findOne({ code: order.couponCode });
    if (coupon) {
      await CouponUsage.create({
        coupon: coupon._id,
        user: order.user,
        order: order._id,
      });
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usageCount: 1 } });
    }
  }
}

module.exports = new PaymentService();
