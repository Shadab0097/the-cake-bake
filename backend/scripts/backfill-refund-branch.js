/**
 * One-time backfill: stamp branchId onto existing refunds.
 *
 * Refunds now snapshot the fulfilling branch from their order at creation, but
 * refunds created before that field existed have branchId: null and are visible
 * to the owner only. This copies each such refund's branch from its order so a
 * branch admin sees their own historical refunds.
 *
 * Run AFTER backfill:order-branch so orders already carry a branchId.
 * Safe to re-run: only touches refunds with no branchId.
 *
 * Usage:
 *   node scripts/backfill-refund-branch.js            # apply
 *   node scripts/backfill-refund-branch.js --dry-run  # report only, no writes
 */
const mongoose = require('mongoose');
const { validateEnv } = require('../src/config/env');
const connectDB = require('../src/config/db');
const logger = require('../src/middleware/logger');
const Refund = require('../src/models/Refund');
const Order = require('../src/models/Order');

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  validateEnv();
  await connectDB();

  const refunds = await Refund.find({ $or: [{ branchId: null }, { branchId: { $exists: false } }] })
    .select('_id order')
    .lean();
  logger.info(`[backfill-refund-branch] ${refunds.length} refund(s) without a branch`);
  if (refunds.length === 0) {
    await mongoose.disconnect();
    process.exit(0);
  }

  const orderIds = [...new Set(refunds.map((r) => String(r.order)).filter(Boolean))];
  const orders = await Order.find({ _id: { $in: orderIds } }).select('branchId').lean();
  const branchByOrder = new Map(orders.map((o) => [String(o._id), o.branchId || null]));

  const ops = [];
  let unresolved = 0;
  for (const r of refunds) {
    const branchId = branchByOrder.get(String(r.order));
    if (!branchId) { unresolved += 1; continue; }
    ops.push({ updateOne: { filter: { _id: r._id }, update: { $set: { branchId } } } });
  }

  logger.info(`[backfill-refund-branch] ${ops.length} resolvable, ${unresolved} still unrouted (order has no branch)`);
  if (!dryRun && ops.length > 0) {
    const res = await Refund.bulkWrite(ops);
    logger.info(`[backfill-refund-branch] updated ${res.modifiedCount} refund(s)`);
  } else if (dryRun) {
    logger.info('[backfill-refund-branch] dry run — no changes written');
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`[backfill-refund-branch] failed: ${err.message}`);
  process.exit(1);
});
