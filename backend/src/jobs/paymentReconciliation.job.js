const { env } = require('../config/env');
const paymentReconciliationService = require('../modules/payments/paymentReconciliation.service');
const logger = require('../middleware/logger');

let intervalId = null;
let isRunning = false;

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    await paymentReconciliationService.reconcilePendingPayments();
  } catch (error) {
    logger.error('[PaymentReconciliationJob] Run failed:', error);
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (!env.paymentReconciliation.enabled) {
    logger.info('[PaymentReconciliationJob] Disabled by configuration');
    return () => {};
  }

  const intervalMs = env.paymentReconciliation.intervalMinutes * 60 * 1000;
  logger.info(`[PaymentReconciliationJob] Starting every ${env.paymentReconciliation.intervalMinutes} minute(s); min age ${env.paymentReconciliation.minAgeMinutes} minute(s)`);

  setTimeout(runOnce, 30000).unref();
  intervalId = setInterval(runOnce, intervalMs);
  intervalId.unref();

  return stop;
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

module.exports = { start, stop, runOnce };
