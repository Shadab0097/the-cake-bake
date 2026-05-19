const mongoose = require('mongoose');
const InventoryReservation = require('../../models/InventoryReservation');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const JobLock = require('../../models/JobLock');
const { env } = require('../../config/env');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const logger = require('../../middleware/logger');
const inventoryReservationService = require('./inventoryReservation.service');
const { cancelUnpaidOnlineOrder } = require('./order.lifecycle');
const paymentReconciliationService = require('../payments/paymentReconciliation.service');

const JOB_LOCK_NAME = 'stock-reservation-expiry';
const EXPIRABLE_ORDER_PAYMENT_STATUSES = ['pending', 'failed', 'expired'];
const CAPTURE_REPAIRED_STATUSES = new Set([
  'captured_reconciled',
  'already_paid',
  'captured_checked',
]);
const AUTHORIZED_STATUSES = new Set([
  'authorized_recorded',
  'authorized_skipped',
]);

const buildExpiredReservationQuery = ({
  now = new Date(),
  batchSize = env.stockReservationExpiry.batchSize,
} = {}) => ({
  query: {
    status: 'reserved',
    expiresAt: { $lte: new Date(now) },
  },
  limit: batchSize,
});

const classifyReservationExpiry = ({ order, payment, reconciliationResult } = {}) => {
  if (!order) return { action: 'expire_orphan' };

  if (order.paymentStatus === 'paid' || payment?.status === PAYMENT_STATUSES.CAPTURED) {
    return { action: 'confirm_paid' };
  }

  if (reconciliationResult) {
    if (reconciliationResult.status === 'provider_error' || reconciliationResult.status === 'reconciliation_error') {
      return { action: 'skip_provider_uncertain' };
    }
    if (CAPTURE_REPAIRED_STATUSES.has(reconciliationResult.status)) {
      return { action: 'skip_captured_repaired' };
    }
    if (AUTHORIZED_STATUSES.has(reconciliationResult.status)) {
      return { action: 'skip_authorized' };
    }
  }

  if (order.paymentMethod !== 'online') {
    return { action: 'skip_not_online' };
  }

  if (
    order.status === ORDER_STATUSES.PENDING &&
    EXPIRABLE_ORDER_PAYMENT_STATUSES.includes(order.paymentStatus)
  ) {
    return { action: 'expire_unpaid_online' };
  }

  if (
    order.status === ORDER_STATUSES.CANCELLED &&
    EXPIRABLE_ORDER_PAYMENT_STATUSES.includes(order.paymentStatus)
  ) {
    return { action: 'release_terminal_unpaid' };
  }

  return { action: 'skip_not_expirable' };
};

class InventoryReservationExpiryService {
  constructor(deps = {}) {
    this.InventoryReservationModel = deps.InventoryReservationModel || InventoryReservation;
    this.OrderModel = deps.OrderModel || Order;
    this.PaymentModel = deps.PaymentModel || Payment;
    this.JobLockModel = deps.JobLockModel || JobLock;
    this.mongooseClient = deps.mongooseClient || mongoose;
    this.inventoryReservationService = deps.inventoryReservationService || inventoryReservationService;
    this.paymentReconciliationService = deps.paymentReconciliationService || paymentReconciliationService;
    this.cancelUnpaidOnlineOrder = deps.cancelUnpaidOnlineOrder || cancelUnpaidOnlineOrder;
    this.logger = deps.logger || logger;
    this.owner = deps.owner || `${process.pid}-${Date.now()}`;
  }

  async acquireLock(lockMs) {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + lockMs);

    const existingLock = await this.JobLockModel.findOneAndUpdate(
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
      await this.JobLockModel.create({
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
    await this.JobLockModel.findOneAndUpdate(
      { _id: JOB_LOCK_NAME, owner: this.owner },
      { $set: { lockedUntil: new Date() } }
    );
  }

  async findExpiredReservations(options = {}) {
    const { query, limit } = buildExpiredReservationQuery(options);
    return this.InventoryReservationModel.find(query)
      .sort({ expiresAt: 1, createdAt: 1 })
      .limit(limit)
      .select('_id order expiresAt status')
      .lean();
  }

  async loadContext(reservationId) {
    const reservation = await this.InventoryReservationModel.findOne({
      _id: reservationId,
      status: 'reserved',
    }).lean();
    if (!reservation) return { reservation: null, order: null, payment: null };

    const orderId = reservation.order;
    const [order, payment] = await Promise.all([
      orderId ? this.OrderModel.findById(orderId).lean() : null,
      orderId ? this.PaymentModel.findOne({ order: orderId }).lean() : null,
    ]);

    return { reservation, order, payment };
  }

  async reconcileBeforeExpiry(order, payment) {
    if (!order || order.paymentMethod !== 'online' || !payment?.razorpayOrderId) return null;
    try {
      return await this.paymentReconciliationService.reconcileOne(payment);
    } catch (error) {
      this.logger.warn(`[InventoryReservationExpiry] Reconciliation failed before expiring order ${order.orderNumber}: ${error.message}`);
      return { status: 'reconciliation_error', reason: error.message };
    }
  }

  async executeAction({ action, reservationId, now, reconciliationResult }) {
    const session = await this.mongooseClient.startSession();
    let result = { expired: false, reason: 'not_eligible' };

    try {
      await session.withTransaction(async () => {
        const reservation = await this.InventoryReservationModel.findOne({
          _id: reservationId,
          status: 'reserved',
          expiresAt: { $lte: now },
        }).session(session);

        if (!reservation) {
          result = { expired: false, reason: 'already_processed' };
          return;
        }

        const order = reservation.order
          ? await this.OrderModel.findById(reservation.order).session(session)
          : null;
        const payment = order
          ? await this.PaymentModel.findOne({ order: order._id }).session(session)
          : null;
        const freshAction = classifyReservationExpiry({ order, payment, reconciliationResult }).action;

        if (freshAction === 'expire_orphan') {
          const release = await this.inventoryReservationService.releaseReservationDocument(
            reservation,
            session,
            {
              status: 'expired',
              reason: 'Expired orphan stock reservation',
            }
          );
          result = release.changed
            ? { expired: true, reason: 'orphan_expired' }
            : { expired: false, reason: release.reason };
          return;
        }

        if (freshAction === 'confirm_paid') {
          const confirmation = await this.inventoryReservationService.confirmForOrder(order, session);
          result = confirmation.changed
            ? { expired: false, reason: 'confirmed_paid_order' }
            : { expired: false, reason: 'already_confirmed' };
          return;
        }

        if (freshAction === 'expire_unpaid_online') {
          const lifecycle = await this.cancelUnpaidOnlineOrder(order, {
            session,
            paymentStatus: 'expired',
            paymentRecordStatus: PAYMENT_STATUSES.EXPIRED,
            note: 'Stock reservation expired before payment completion',
            paymentEvent: 'inventory_reservation.expired',
            paymentPayload: {
              reservationId: String(reservation._id),
              expiresAt: reservation.expiresAt,
              jobOwner: this.owner,
            },
          });
          result = lifecycle.changed
            ? { expired: true, orderNumber: order.orderNumber, reason: 'order_expired' }
            : { expired: false, reason: lifecycle.reason };
          return;
        }

        if (freshAction === 'release_terminal_unpaid') {
          const release = await this.inventoryReservationService.releaseReservationDocument(
            reservation,
            session,
            {
              status: 'expired',
              reason: 'Expired reservation for terminal unpaid order',
            }
          );
          result = release.changed
            ? { expired: true, orderNumber: order.orderNumber, reason: 'terminal_order_released' }
            : { expired: false, reason: release.reason };
          return;
        }

        result = { expired: false, reason: freshAction };
      });
    } finally {
      session.endSession();
    }

    if (action === 'skip_captured_repaired') {
      return { expired: false, reason: reconciliationResult.status };
    }

    return result;
  }

  async expireOne(reservationId, options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const { order, payment } = await this.loadContext(reservationId);
    let action = classifyReservationExpiry({ order, payment }).action;
    let reconciliationResult = null;

    if (action === 'expire_unpaid_online') {
      reconciliationResult = await this.reconcileBeforeExpiry(order, payment);
      action = classifyReservationExpiry({ order, payment, reconciliationResult }).action;
    }

    if (action.startsWith('skip_')) {
      return { expired: false, reason: action };
    }

    return this.executeAction({
      action,
      reservationId,
      now,
      reconciliationResult,
    });
  }

  async expireReservations(options = {}) {
    const intervalMinutes = options.intervalMinutes || env.stockReservationExpiry.intervalMinutes;
    const lockMs = Math.max(intervalMinutes * 2 * 60 * 1000, 5 * 60 * 1000);
    const hasLock = await this.acquireLock(lockMs);
    if (!hasLock) return { skipped: true, reason: 'lock_held' };

    try {
      const reservations = await this.findExpiredReservations(options);
      let expiredCount = 0;
      const skipped = {};

      for (const reservation of reservations) {
        try {
          const result = await this.expireOne(reservation._id, options);
          if (result.expired) {
            expiredCount += 1;
          } else if (result.reason) {
            skipped[result.reason] = (skipped[result.reason] || 0) + 1;
          }
        } catch (error) {
          skipped.failed = (skipped.failed || 0) + 1;
          this.logger.error(`[InventoryReservationExpiry] Failed for reservation ${reservation._id}: ${error.message}`);
        }
      }

      if (expiredCount > 0 || reservations.length > 0) {
        this.logger.info(`[InventoryReservationExpiry] checked=${reservations.length} expired=${expiredCount} skipped=${JSON.stringify(skipped)}`);
      }

      return {
        checked: reservations.length,
        expired: expiredCount,
        skipped,
      };
    } finally {
      await this.releaseLock();
    }
  }
}

const service = new InventoryReservationExpiryService();

module.exports = service;
module.exports.InventoryReservationExpiryService = InventoryReservationExpiryService;
module.exports.buildExpiredReservationQuery = buildExpiredReservationQuery;
module.exports.classifyReservationExpiry = classifyReservationExpiry;
