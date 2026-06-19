/**
 * One-time backfill: mark already-delivered COD orders as paid.
 *
 * COD orders only count toward revenue once paymentStatus === 'paid'. New
 * deliveries are handled in order.service.updateOrderStatus, but orders that
 * were delivered before that fix still read paymentStatus: 'pending' and are
 * therefore missing from every revenue report (revenue, trend, top products,
 * top cities). This sweeps them once so historical numbers become correct.
 *
 * Usage:
 *   node scripts/backfill-cod-revenue.js            # apply
 *   node scripts/backfill-cod-revenue.js --dry-run  # count only, no writes
 */
const mongoose = require('mongoose');
const { validateEnv } = require('../src/config/env');
const connectDB = require('../src/config/db');
const logger = require('../src/middleware/logger');
const Order = require('../src/models/Order');

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  validateEnv();
  await connectDB();

  const filter = {
    paymentMethod: 'cod',
    status: 'delivered',
    paymentStatus: { $ne: 'paid' },
  };

  const count = await Order.countDocuments(filter);
  logger.info(`[backfill-cod-revenue] ${count} delivered COD order(s) need paymentStatus='paid'`);

  if (dryRun) {
    logger.info('[backfill-cod-revenue] dry run — no changes written');
  } else if (count > 0) {
    const result = await Order.updateMany(filter, { $set: { paymentStatus: 'paid' } });
    logger.info(`[backfill-cod-revenue] updated ${result.modifiedCount} order(s)`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`[backfill-cod-revenue] failed: ${err.message}`);
  process.exit(1);
});
