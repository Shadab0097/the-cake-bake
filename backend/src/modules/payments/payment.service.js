const crypto = require('crypto');
const Payment = require('../../models/Payment');
const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
const LoyaltyPoints = require('../../models/LoyaltyPoints');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const logger = require('../../middleware/logger');

class PaymentService {
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
      throw ApiError.badRequest('Payment verification failed — invalid signature');
    }

    // Find payment record
    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) throw ApiError.notFound('Payment record not found');

    // IDEMPOTENCY: If already captured, return success without re-processing
    if (payment.status === PAYMENT_STATUSES.CAPTURED) {
      const existingOrder = await Order.findById(payment.order).lean();
      logger.info(`Payment already captured for order ${existingOrder?.orderNumber} (idempotent return)`);
      return {
        success: true,
        orderNumber: existingOrder?.orderNumber,
        paymentId: payment.razorpayPaymentId,
      };
    }

    // Update payment record
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.status = PAYMENT_STATUSES.CAPTURED;
    await payment.save();

    // Update order — CRITICAL PATH
    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'paid';
      order.status = ORDER_STATUSES.CONFIRMED;
      order.statusHistory.push({
        status: ORDER_STATUSES.CONFIRMED,
        timestamp: new Date(),
        note: 'Payment verified',
      });
      await order.save();

      // Decrement stock — CRITICAL: check result
      await this.decrementStock(order);

      // Record coupon usage — CRITICAL
      if (order.couponCode) {
        await this.recordCouponUsage(order);
      }

      // NON-CRITICAL operations — fire-and-forget async to reduce response latency
      setImmediate(async () => {
        try {
          // Clear cart
          await Cart.findOneAndUpdate(
            { user: userId },
            { items: [], appliedCoupon: null, deliveryNotes: '' }
          );

          // Update product order counts
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

          // Send WhatsApp notification
          const notificationService = require('../notifications/notification.service');
          await notificationService.sendOrderConfirmation(order, payment);
        } catch (asyncErr) {
          logger.warn('Non-critical post-payment task failed:', asyncErr.message);
        }
      });
    }

    return {
      success: true,
      orderNumber: order?.orderNumber,
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

    // Idempotency check
    const razorpayPaymentId = event.payload?.payment?.entity?.id;
    if (razorpayPaymentId) {
      const existingPayment = await Payment.findOne({
        razorpayPaymentId,
        status: PAYMENT_STATUSES.CAPTURED,
      });
      if (existingPayment) {
        logger.info(`Webhook already processed for payment ${razorpayPaymentId}`);
        return { status: 'already_processed' };
      }
    }

    switch (eventType) {
      case 'payment.captured': {
        const paymentEntity = event.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        const payment = await Payment.findOne({ razorpayOrderId });
        if (payment && payment.status !== PAYMENT_STATUSES.CAPTURED) {
          payment.razorpayPaymentId = paymentEntity.id;
          payment.status = PAYMENT_STATUSES.CAPTURED;
          payment.method = paymentEntity.method;
          payment.webhookEvents.push({
            event: eventType,
            payload: paymentEntity,
            receivedAt: new Date(),
          });
          await payment.save();

          // Update order if not already confirmed
          const order = await Order.findById(payment.order);
          if (order && order.status === ORDER_STATUSES.PENDING) {
            order.paymentStatus = 'paid';
            order.status = ORDER_STATUSES.CONFIRMED;
            order.statusHistory.push({
              status: ORDER_STATUSES.CONFIRMED,
              timestamp: new Date(),
              note: 'Payment confirmed via webhook',
            });
            await order.save();
            await this.decrementStock(order);
            if (order.couponCode) await this.recordCouponUsage(order);
          }
        }
        break;
      }

      case 'payment.failed': {
        const paymentEntity = event.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        const payment = await Payment.findOne({ razorpayOrderId });
        if (payment) {
          payment.status = PAYMENT_STATUSES.FAILED;
          payment.webhookEvents.push({
            event: eventType,
            payload: paymentEntity,
            receivedAt: new Date(),
          });
          await payment.save();

          const order = await Order.findById(payment.order);
          if (order) {
            order.paymentStatus = 'failed';
            await order.save();
          }
        }
        break;
      }

      default:
        logger.info(`Unhandled webhook event: ${eventType}`);
    }

    return { status: 'processed' };
  }

  /**
   * Decrement stock for order items
   */
  async decrementStock(order) {
    for (const item of order.items) {
      if (item.product) {
        // Find the variant by product and weight, decrement stock with guard
        const result = await Variant.updateOne(
          { product: item.product, weight: item.weight, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );
        // SAFETY: Log if stock was insufficient (guard prevented decrement)
        if (result.modifiedCount === 0) {
          logger.warn(`Stock decrement skipped — insufficient stock for product ${item.product}, weight ${item.weight}, qty ${item.quantity} (order ${order.orderNumber})`);
        }
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
