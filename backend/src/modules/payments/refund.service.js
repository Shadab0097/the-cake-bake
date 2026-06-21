const mongoose = require('mongoose');

const Refund = require('../../models/Refund');
const Payment = require('../../models/Payment');
const Order = require('../../models/Order');
const ApiError = require('../../utils/ApiError');
const { getRazorpayInstance } = require('../../config/razorpay');
const { ORDER_STATUSES, PAYMENT_STATUSES, REFUND_STATUSES } = require('../../utils/constants');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const logger = require('../../middleware/logger');

const REFUNDABLE_PAYMENT_STATUSES = new Set([
  PAYMENT_STATUSES.CAPTURED,
  PAYMENT_STATUSES.REFUNDED,
]);

const pushEvent = (status, note = '', actor = null) => ({
  status,
  note,
  actor,
  at: new Date(),
});

class RefundService {
  constructor(deps = {}) {
    this.RefundModel = deps.RefundModel || Refund;
    this.PaymentModel = deps.PaymentModel || Payment;
    this.OrderModel = deps.OrderModel || Order;
    this.getRazorpay = deps.getRazorpayInstance || getRazorpayInstance;
    this.mongooseClient = deps.mongooseClient || mongoose;
    this.logger = deps.logger || logger;
  }

  async requestForOrder({ order, payment, amount, reason = '', requestedBy = 'customer', requestedByUser = null, session }) {
    if (!session) throw new Error('requestForOrder requires a mongoose session');
    if (!order || !payment) throw ApiError.badRequest('Refund cannot be requested without a payment record', [], 'REFUND_PAYMENT_REQUIRED');
    if (order.paymentMethod !== 'online' || order.paymentStatus !== 'paid') return null;
    if (!REFUNDABLE_PAYMENT_STATUSES.has(payment.status)) {
      throw ApiError.badRequest('Only captured online payments can enter the refund workflow', [], 'REFUND_NOT_ALLOWED');
    }

    const refundAmount = amount || order.total;
    const event = pushEvent(REFUND_STATUSES.REQUESTED, reason, requestedByUser);

    const refund = await this.RefundModel.findOneAndUpdate(
      { order: order._id, payment: payment._id },
      {
        $setOnInsert: {
          order: order._id,
          payment: payment._id,
          branchId: order.branchId || null,
          user: order.user || null,
          amount: refundAmount,
          currency: payment.currency || 'INR',
          status: REFUND_STATUSES.REQUESTED,
          requestedBy,
          requestedByUser,
          reason,
          events: [event],
        },
      },
      { upsert: true, new: true, session }
    );

    const refundStatus = refund.status || REFUND_STATUSES.REQUESTED;
    payment.refundStatus = refundStatus;
    payment.refundAmount = refundAmount;
    payment.refundRequestedAt = payment.refundRequestedAt || new Date();
    await payment.save({ session });

    order.refundStatus = refundStatus;
    order.refundAmount = refundAmount;
    await order.save({ session });

    return refund;
  }

  async approve(refundId, adminId, note = 'Refund approved') {
    const refund = await this.RefundModel.findOneAndUpdate(
      {
        _id: refundId,
        status: REFUND_STATUSES.REQUESTED,
      },
      {
        $set: {
          status: REFUND_STATUSES.APPROVED,
          approvedBy: adminId,
        },
        $push: {
          events: pushEvent(REFUND_STATUSES.APPROVED, note, adminId),
        },
      },
      { new: true }
    );

    if (!refund) throw ApiError.badRequest('Refund is not awaiting approval', [], 'REFUND_NOT_AWAITING_APPROVAL');
    await this.PaymentModel.updateOne({ _id: refund.payment }, { $set: { refundStatus: REFUND_STATUSES.APPROVED } });
    await this.OrderModel.updateOne({ _id: refund.order }, { $set: { refundStatus: REFUND_STATUSES.APPROVED } });
    return refund;
  }

  async markFailed(refundId, adminId, reason = 'Refund failed') {
    const refund = await this.RefundModel.findById(refundId);
    if (!refund) throw ApiError.notFound('Refund not found', [], 'REFUND_NOT_FOUND');
    if (refund.status === REFUND_STATUSES.REFUNDED) {
      throw ApiError.badRequest('Refund is already completed', [], 'REFUND_ALREADY_COMPLETED');
    }

    refund.status = REFUND_STATUSES.FAILED;
    refund.failureReason = reason;
    refund.events.push(pushEvent(REFUND_STATUSES.FAILED, reason, adminId));
    await refund.save();

    await Promise.all([
      this.PaymentModel.updateOne({ _id: refund.payment }, { $set: { refundStatus: REFUND_STATUSES.FAILED } }),
      this.OrderModel.updateOne({ _id: refund.order }, { $set: { refundStatus: REFUND_STATUSES.FAILED } }),
    ]);

    return refund;
  }

  async markSucceeded({ refund, providerRefund, adminId, session }) {
    const now = new Date();
    const razorpayRefundId = providerRefund?.id || refund.razorpayRefundId || '';

    refund.status = REFUND_STATUSES.REFUNDED;
    refund.razorpayRefundId = razorpayRefundId;
    refund.processedBy = adminId || refund.processedBy || null;
    refund.processedAt = now;
    refund.failureReason = '';
    refund.events.push(pushEvent(REFUND_STATUSES.REFUNDED, 'Refund completed', adminId));
    await refund.save({ session });

    await this.PaymentModel.updateOne(
      { _id: refund.payment },
      {
        $set: {
          status: PAYMENT_STATUSES.REFUNDED,
          refundStatus: REFUND_STATUSES.REFUNDED,
          refundId: razorpayRefundId,
          refundAmount: refund.amount,
          refundedAt: now,
        },
      },
      { session }
    );

    await this.OrderModel.updateOne(
      { _id: refund.order },
      {
        $set: {
          status: ORDER_STATUSES.REFUNDED,
          paymentStatus: 'refunded',
          refundStatus: REFUND_STATUSES.REFUNDED,
          refundAmount: refund.amount,
        },
        $push: {
          statusHistory: {
            status: ORDER_STATUSES.REFUNDED,
            timestamp: now,
            note: 'Refund completed',
            updatedBy: adminId || undefined,
          },
        },
      },
      { session }
    );

    return refund;
  }

  async processApproved(refundId, adminId) {
    const refund = await this.RefundModel.findOneAndUpdate(
      {
        _id: refundId,
        status: REFUND_STATUSES.APPROVED,
      },
      {
        $set: {
          status: REFUND_STATUSES.PROCESSING,
          processedBy: adminId,
          failureReason: '',
        },
        $push: {
          events: pushEvent(REFUND_STATUSES.PROCESSING, 'Refund processing started', adminId),
        },
      },
      { new: true }
    );

    if (!refund) throw ApiError.badRequest('Refund is not approved for processing', [], 'REFUND_NOT_APPROVED');

    await Promise.all([
      this.PaymentModel.updateOne({ _id: refund.payment }, { $set: { refundStatus: REFUND_STATUSES.PROCESSING } }),
      this.OrderModel.updateOne({ _id: refund.order }, { $set: { refundStatus: REFUND_STATUSES.PROCESSING } }),
    ]);

    const payment = await this.PaymentModel.findById(refund.payment).lean();
    if (!payment?.razorpayPaymentId) {
      return this.markFailed(refund._id, adminId, 'Missing Razorpay payment id');
    }

    let providerRefund;
    try {
      const razorpay = this.getRazorpay();
      providerRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: refund.amount,
        notes: {
          orderId: String(refund.order),
          refundId: String(refund._id),
        },
        receipt: String(refund._id),
      });
    } catch (error) {
      this.logger.error(`[Refund] Razorpay refund failed for ${refund._id}: ${error.message}`);
      return this.markFailed(refund._id, adminId, error.message || 'Razorpay refund failed');
    }

    const session = await this.mongooseClient.startSession();
    try {
      await session.withTransaction(async () => {
        const sessionRefund = await this.RefundModel.findById(refund._id).session(session);
        if (!sessionRefund || sessionRefund.status === REFUND_STATUSES.REFUNDED) return;
        await this.markSucceeded({ refund: sessionRefund, providerRefund, adminId, session });
      });
    } finally {
      session.endSession();
    }

    return this.RefundModel.findById(refund._id);
  }

  async list(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.user) filter.user = query.user;
    // Branch data-scope: controller passes a resolved branchIds[] set. Legacy
    // refunds (no branchId) remain owner-only until a refund backfill.
    const branchIds = require('../../utils/branchScope').toObjectIds(query);
    if (branchIds.length) filter.branchId = { $in: branchIds };

    const [refunds, total] = await Promise.all([
      this.RefundModel.find(filter)
        .populate('order', 'orderNumber status paymentStatus total')
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.RefundModel.countDocuments(filter),
    ]);

    return paginatedResponse(refunds, total, page, limit);
  }
}

const service = new RefundService();

module.exports = service;
module.exports.RefundService = RefundService;
module.exports.pushEvent = pushEvent;
