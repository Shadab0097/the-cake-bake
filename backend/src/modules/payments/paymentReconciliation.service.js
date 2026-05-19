const Payment = require('../../models/Payment');
const JobLock = require('../../models/JobLock');
const { getRazorpayInstance } = require('../../config/razorpay');
const { env } = require('../../config/env');
const { PAYMENT_STATUSES } = require('../../utils/constants');
const logger = require('../../middleware/logger');
const paymentService = require('./payment.service');
const operationalAlertService = require('../monitoring/operationalAlert.service');

const JOB_LOCK_NAME = 'payment-reconciliation';
const RECONCILABLE_PAYMENT_STATUSES = [
  PAYMENT_STATUSES.CREATED,
  PAYMENT_STATUSES.PENDING,
  PAYMENT_STATUSES.AUTHORIZED,
  PAYMENT_STATUSES.FAILED,
  PAYMENT_STATUSES.EXPIRED,
  PAYMENT_STATUSES.CAPTURED,
];

const latestByStatus = (payments, status) => {
  return payments
    .filter((payment) => payment?.status === status)
    .sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0))[0] || null;
};

const selectProviderPayment = (items = []) => {
  const payments = Array.isArray(items) ? items : [];
  return latestByStatus(payments, 'captured') ||
    latestByStatus(payments, 'authorized') ||
    latestByStatus(payments, 'failed') ||
    null;
};

const buildCandidateQuery = ({
  now = new Date(),
  minAgeMinutes = env.paymentReconciliation.minAgeMinutes,
  lookbackHours = env.paymentReconciliation.lookbackHours,
  batchSize = env.paymentReconciliation.batchSize,
} = {}) => {
  const nowMs = new Date(now).getTime();
  const latestCreatedAt = new Date(nowMs - minAgeMinutes * 60 * 1000);
  const earliestCreatedAt = new Date(nowMs - lookbackHours * 60 * 60 * 1000);

  return {
    query: {
      razorpayOrderId: { $type: 'string', $ne: '' },
      status: { $in: RECONCILABLE_PAYMENT_STATUSES },
      createdAt: { $gte: earliestCreatedAt, $lte: latestCreatedAt },
    },
    limit: batchSize,
  };
};

class PaymentReconciliationService {
  constructor(deps = {}) {
    this.PaymentModel = deps.PaymentModel || Payment;
    this.JobLockModel = deps.JobLockModel || JobLock;
    this.paymentService = deps.paymentService || paymentService;
    this.operationalAlertService = deps.operationalAlertService || operationalAlertService;
    this.getRazorpay = deps.getRazorpayInstance || getRazorpayInstance;
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

  async fetchProviderPayment(payment) {
    if (!payment?.razorpayOrderId) {
      return { providerPayment: null };
    }

    try {
      const razorpay = this.getRazorpay();
      const result = await razorpay.orders.fetchPayments(payment.razorpayOrderId);
      return { providerPayment: selectProviderPayment(result?.items) };
    } catch (error) {
      this.logger.warn(`[PaymentReconciliation] Provider lookup failed for ${payment.razorpayOrderId}: ${error.message}`);
      return { providerPayment: null, error };
    }
  }

  async recordAuthorizedPayment(payment, providerPayment) {
    const updated = await this.PaymentModel.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $nin: [PAYMENT_STATUSES.CAPTURED, PAYMENT_STATUSES.REFUNDED] },
      },
      {
        $set: {
          status: PAYMENT_STATUSES.AUTHORIZED,
          razorpayPaymentId: providerPayment.id || payment.razorpayPaymentId || '',
          method: providerPayment.method || payment.method || 'online',
        },
      },
      { new: true }
    );

    if (updated) {
      await this.paymentService.recordPaymentWebhookEvent(
        updated._id,
        `reconciliation:authorized:${providerPayment.id || payment.razorpayOrderId}`,
        'payment.reconciled_authorized',
        providerPayment
      );
    }

    return { status: updated ? 'authorized_recorded' : 'authorized_skipped' };
  }

  async recordFailedPayment(payment, providerPayment) {
    const updated = await this.PaymentModel.findOneAndUpdate(
      {
        _id: payment._id,
        status: { $in: [PAYMENT_STATUSES.CREATED, PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.AUTHORIZED] },
      },
      {
        $set: {
          status: PAYMENT_STATUSES.FAILED,
          razorpayPaymentId: providerPayment.id || payment.razorpayPaymentId || '',
          method: providerPayment.method || payment.method || 'online',
        },
      },
      { new: true }
    );

    if (updated) {
      await this.paymentService.recordPaymentWebhookEvent(
        updated._id,
        `reconciliation:failed:${providerPayment.id || payment.razorpayOrderId}`,
        'payment.reconciled_failed',
        providerPayment
      );
    }

    return { status: updated ? 'failed_recorded' : 'failed_skipped' };
  }

  async reconcileOne(payment) {
    const { providerPayment, error } = await this.fetchProviderPayment(payment);
    if (error) return { status: 'provider_error', reason: error.message };
    if (!providerPayment) return { status: 'provider_no_payment' };

    if (providerPayment.status === 'captured') {
      const result = await this.paymentService.reconcileCapturedProviderPayment(payment, providerPayment);
      return {
        status: result.reason || (result.repaired ? 'captured_reconciled' : 'captured_checked'),
        orderNumber: result.orderNumber,
      };
    }

    if (providerPayment.status === 'authorized') {
      return this.recordAuthorizedPayment(payment, providerPayment);
    }

    if (providerPayment.status === 'failed') {
      return this.recordFailedPayment(payment, providerPayment);
    }

    return { status: `provider_${providerPayment.status || 'unknown'}` };
  }

  async findCandidatePayments(options = {}) {
    const { query, limit } = buildCandidateQuery(options);
    return this.PaymentModel.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .select('_id order user razorpayOrderId razorpayPaymentId status method createdAt updatedAt')
      .lean();
  }

  async reconcilePendingPayments(options = {}) {
    const intervalMinutes = options.intervalMinutes || env.paymentReconciliation.intervalMinutes;
    const lockMs = Math.max(intervalMinutes * 2 * 60 * 1000, 5 * 60 * 1000);
    const hasLock = await this.acquireLock(lockMs);
    if (!hasLock) return { skipped: true, reason: 'lock_held' };

    try {
      const candidates = await this.findCandidatePayments(options);
      const results = {
        checked: candidates.length,
        repaired: 0,
        statuses: {},
      };

      for (const candidate of candidates) {
        try {
          const result = await this.reconcileOne(candidate);
          results.statuses[result.status] = (results.statuses[result.status] || 0) + 1;
          if (result.status === 'captured_reconciled') {
            results.repaired += 1;
          }
        } catch (error) {
          results.statuses.failed = (results.statuses.failed || 0) + 1;
          await this.operationalAlertService.recordPaymentMismatch({
            payment: candidate,
            reason: error.message || 'Payment reconciliation failed',
            source: 'payment.reconciliation',
            metadata: {
              razorpayOrderId: candidate.razorpayOrderId,
            },
          });
          this.logger.error(`[PaymentReconciliation] Failed for ${candidate.razorpayOrderId}: ${error.message}`);
        }
      }

      if (results.checked > 0) {
        this.logger.info(`[PaymentReconciliation] checked=${results.checked} repaired=${results.repaired} statuses=${JSON.stringify(results.statuses)}`);
      }

      return results;
    } finally {
      await this.releaseLock();
    }
  }
}

const service = new PaymentReconciliationService();

module.exports = service;
module.exports.PaymentReconciliationService = PaymentReconciliationService;
module.exports.buildCandidateQuery = buildCandidateQuery;
module.exports.selectProviderPayment = selectProviderPayment;
