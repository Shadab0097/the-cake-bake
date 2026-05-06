const { env } = require('../config/env');
const orderExpiryService = require('../modules/orders/orderExpiry.service');
const logger = require('../middleware/logger');

let intervalId = null;
let isRunning = false;

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    await orderExpiryService.expireStaleOnlineOrders();
  } catch (error) {
    logger.error('[OrderExpiryJob] Run failed:', error);
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (!env.orders.expiryJobEnabled) {
    logger.info('[OrderExpiryJob] Disabled by configuration');
    return () => {};
  }

  const intervalMs = env.orders.expiryJobIntervalMinutes * 60 * 1000;
  logger.info(`[OrderExpiryJob] Starting every ${env.orders.expiryJobIntervalMinutes} minute(s); online payment expiry ${env.orders.onlinePaymentExpiryMinutes} minute(s)`);

  setTimeout(runOnce, 10000).unref();
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
