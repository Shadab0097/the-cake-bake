const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const JobLock = require('../../models/JobLock');
const { env } = require('../../config/env');
const { getRazorpayInstance } = require('../../config/razorpay');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const logger = require('../../middleware/logger');
const { cancelUnpaidOnlineOrder } = require('./order.lifecycle');

const JOB_LOCK_NAME = 'expire-stale-online-orders';
const STALE_PAYMENT_STATUSES = ['pending', 'failed'];

class OrderExpiryService {
  constructor() {
    this.owner = `${process.pid}-${Date.now()}`;
  }

  async acquireLock(lockMs) {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + lockMs);

    const existingLock = await JobLock.findOneAndUpdate(
      {
        _id: JOB_LOCK_NAME,
        lockedUntil: { $lte: now },
      },
      {
        $set: {
          owner: this.owner,
          lockedUntil,
        },
      },
      { new: true }
    );

    if (existingLock) return true;

    try {
      await JobLock.create({
        _id: JOB_LOCK_NAME,
        owner: this.owner,
        lockedUntil,
      });
      return true;
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }
  }

  async releaseLock() {
    await JobLock.findOneAndUpdate(
      { _id: JOB_LOCK_NAME, owner: this.owner },
      { $set: { lockedUntil: new Date() } }
    );
  }

  async hasCapturedProviderPayment(payment) {
    if (!payment?.razorpayOrderId) return false;

    try {
      const razorpay = getRazorpayInstance();
      const result = await razorpay.orders.fetchPayments(payment.razorpayOrderId);
      const payments = Array.isArray(result?.items) ? result.items : [];
      return payments.some((item) => item.status === 'captured' || item.status === 'authorized');
    } catch (error) {
      logger.warn(`[OrderExpiry] Razorpay reconciliation skipped for ${payment.razorpayOrderId}: ${error.message}`);
      return true;
    }
  }

  async expireOne(orderId, cutoff, expiryMinutes) {
    const payment = await Payment.findOne({ order: orderId }).lean();
    if (payment?.status === PAYMENT_STATUSES.CAPTURED) {
      return { expired: false, reason: 'already_captured' };
    }

    if (await this.hasCapturedProviderPayment(payment)) {
      return { expired: false, reason: 'provider_reconciliation_pending' };
    }

    const session = await mongoose.startSession();

    try {
      let result = { expired: false, reason: 'not_eligible' };

      await session.withTransaction(async () => {
        const order = await Order.findOne({
          _id: orderId,
          paymentMethod: 'online',
          paymentStatus: { $in: STALE_PAYMENT_STATUSES },
          status: ORDER_STATUSES.PENDING,
          createdAt: { $lte: cutoff },
        }).session(session);

        if (!order) return;

        const lifecycleResult = await cancelUnpaidOnlineOrder(order, {
          session,
          paymentStatus: 'expired',
          paymentRecordStatus: PAYMENT_STATUSES.EXPIRED,
          note: `Online payment expired after ${expiryMinutes} minutes`,
          paymentEvent: 'order.payment_expired',
          paymentPayload: {
            cutoff,
            expiryMinutes,
            jobOwner: this.owner,
          },
        });

        result = lifecycleResult.changed
          ? { expired: true, orderNumber: order.orderNumber }
          : { expired: false, reason: lifecycleResult.reason };
      });

      return result;
    } finally {
      session.endSession();
    }
  }

  async expireStaleOnlineOrders(options = {}) {
    const expiryMinutes = options.expiryMinutes || env.orders.onlinePaymentExpiryMinutes;
    const batchSize = options.batchSize || env.orders.expiryBatchSize;
    const intervalMinutes = env.orders.expiryJobIntervalMinutes;
    const lockMs = Math.max(intervalMinutes * 2 * 60 * 1000, 5 * 60 * 1000);

    const hasLock = await this.acquireLock(lockMs);
    if (!hasLock) return { skipped: true, reason: 'lock_held' };

    try {
      const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000);
      const candidates = await Order.find({
        paymentMethod: 'online',
        paymentStatus: { $in: STALE_PAYMENT_STATUSES },
        status: ORDER_STATUSES.PENDING,
        createdAt: { $lte: cutoff },
      })
        .sort({ createdAt: 1 })
        .limit(batchSize)
        .select('_id orderNumber')
        .lean();

      let expiredCount = 0;
      const skipped = {};

      for (const candidate of candidates) {
        const result = await this.expireOne(candidate._id, cutoff, expiryMinutes);
        if (result.expired) {
          expiredCount += 1;
        } else if (result.reason) {
          skipped[result.reason] = (skipped[result.reason] || 0) + 1;
        }
      }

      if (expiredCount > 0 || candidates.length > 0) {
        logger.info(`[OrderExpiry] checked=${candidates.length} expired=${expiredCount} skipped=${JSON.stringify(skipped)}`);
      }

      return {
        checked: candidates.length,
        expired: expiredCount,
        skipped,
      };
    } finally {
      await this.releaseLock();
    }
  }
}

module.exports = new OrderExpiryService();
