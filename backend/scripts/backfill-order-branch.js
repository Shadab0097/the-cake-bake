/**
 * One-time backfill: stamp branchId onto existing orders.
 *
 * branchId is now snapshotted at checkout (the fulfilling store), but orders
 * placed before that field existed have branchId: null. This resolves each such
 * order's branch by matching its deliveryCity to a zone that is assigned to a
 * branch (case-insensitive), so historical location-wise reports and invoices
 * use the authoritative branch key instead of a fragile city string.
 *
 * Safe to re-run: only touches orders with branchId: null.
 *
 * Usage:
 *   node scripts/backfill-order-branch.js            # apply
 *   node scripts/backfill-order-branch.js --dry-run  # report only, no writes
 */
const mongoose = require('mongoose');
const { validateEnv } = require('../src/config/env');
const connectDB = require('../src/config/db');
const logger = require('../src/middleware/logger');
const Order = require('../src/models/Order');
const DeliveryZone = require('../src/models/DeliveryZone');

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  validateEnv();
  await connectDB();

  // Build a case-insensitive city → branchId map from zones that have a branch.
  const zones = await DeliveryZone.find({ branchId: { $ne: null } })
    .select('city branchId')
    .lean();
  const cityToBranch = new Map();
  for (const z of zones) {
    const key = String(z.city || '').trim().toLowerCase();
    if (key && !cityToBranch.has(key)) cityToBranch.set(key, z.branchId);
  }
  // Fallback branch for cities not mapped to any branched zone (owner's choice:
  // auto-assign orphans to the default branch).
  const Settings = require('../src/models/Settings');
  const settings = await Settings.findOne({ key: 'global' }).select('defaultBranchId').lean();
  const defaultBranchId = settings?.defaultBranchId || null;
  logger.info(`[backfill-order-branch] ${cityToBranch.size} city→branch mapping(s) from ${zones.length} branched zone(s); default branch: ${defaultBranchId || 'none'}`);

  if (cityToBranch.size === 0 && !defaultBranchId) {
    logger.warn('[backfill-order-branch] No branched zones and no default branch — nothing to map. Assign zones to branches or set a default branch first.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const distinctCities = await Order.distinct('deliveryCity', { branchId: null });
  let totalMatched = 0;
  let totalUpdated = 0;

  for (const city of distinctCities) {
    const branchId = cityToBranch.get(String(city || '').trim().toLowerCase()) || defaultBranchId;
    if (!branchId) continue;
    const filter = { branchId: null, deliveryCity: city };
    const count = await Order.countDocuments(filter);
    totalMatched += count;
    logger.info(`[backfill-order-branch] "${city}" → branch ${branchId} : ${count} order(s)`);
    if (!dryRun && count > 0) {
      const res = await Order.updateMany(filter, { $set: { branchId } });
      totalUpdated += res.modifiedCount;
    }
  }

  logger.info(`[backfill-order-branch] ${dryRun ? 'would update' : 'updated'} ${dryRun ? totalMatched : totalUpdated} order(s)`);
  if (dryRun) logger.info('[backfill-order-branch] dry run — no changes written');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`[backfill-order-branch] failed: ${err.message}`);
  process.exit(1);
});
