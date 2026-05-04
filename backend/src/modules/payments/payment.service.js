const crypto = require('crypto');
const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const Order = require('../../models/Order');
const Cart = require('../../models/Cart');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const User = require('../../models/User');
const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
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

    // FIX: Atomic idempotency check-and-set using findOneAndUpdate
    // This prevents the race condition where two simultaneous requests both
    // pass the status check before either saves, causing double processing.
    const payment = await Payment.findOneAndUpdate(
      {
        razorpayOrderId,
        status: { $ne: PAYMENT_STATUSES.CAPTURED }, // Only update if not already captured
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

    // If no document was updated, payment was already captured (idempotent return)
    if (!payment) {
      const existingPayment = await Payment.findOne({ razorpayOrderId });
      if (!existingPayment) throw ApiError.notFound('Payment record not found');

      const existingOrder = await Order.findById(existingPayment.order).lean();
      logger.info(`Payment already captured for order ${existingOrder?.orderNumber} (idempotent return)`);
      return {
        success: true,
        orderNumber: existingOrder?.orderNumber,
        paymentId: existingPayment.razorpayPaymentId,
      };
    }

    // Update order — CRITICAL PATH
    const order = await Order.findById(payment.order);
    if (order && order.status !== ORDER_STATUSES.CONFIRMED) {
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

          // Send confirmation notification
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

    switch (eventType) {
      case 'payment.captured': {
        const paymentEntity = event.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;
        const razorpayPaymentId = paymentEntity.id;

        // FIX: Atomic idempotency — findOneAndUpdate with $ne guard
        const payment = await Payment.findOneAndUpdate(
          {
            razorpayOrderId,
            status: { $ne: PAYMENT_STATUSES.CAPTURED },
          },
          {
            $set: {
              razorpayPaymentId,
              status: PAYMENT_STATUSES.CAPTURED,
              method: paymentEntity.method,
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
          logger.info(`Webhook skipped — payment ${razorpayPaymentId} already captured or not found`);
          break;
        }

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
        break;
      }

      case 'payment.failed': {
        const paymentEntity = event.payload.payment.entity;
        const razorpayOrderId = paymentEntity.order_id;

        const payment = await Payment.findOneAndUpdate(
          { razorpayOrderId, status: { $ne: PAYMENT_STATUSES.CAPTURED } },
          {
            $set: { status: PAYMENT_STATUSES.FAILED },
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

        if (payment) {
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
        logger.warn(`[Payment] ${notUpdated} item(s) had insufficient stock during order ${order.orderNumber} — stock guard prevented decrement`);
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
