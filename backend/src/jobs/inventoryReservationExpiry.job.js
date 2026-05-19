const { env } = require('../config/env');
const inventoryReservationExpiryService = require('../modules/orders/inventoryReservationExpiry.service');
const logger = require('../middleware/logger');

let intervalId = null;
let isRunning = false;

const runOnce = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    await inventoryReservationExpiryService.expireReservations();
  } catch (error) {
    logger.error('[InventoryReservationExpiryJob] Run failed:', error);
  } finally {
    isRunning = false;
  }
};

const start = () => {
  if (!env.stockReservationExpiry.enabled) {
    logger.info('[InventoryReservationExpiryJob] Disabled by configuration');
    return () => {};
  }

  const intervalMs = env.stockReservationExpiry.intervalMinutes * 60 * 1000;
  logger.info(`[InventoryReservationExpiryJob] Starting every ${env.stockReservationExpiry.intervalMinutes} minute(s)`);

  setTimeout(runOnce, 45000).unref();
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
