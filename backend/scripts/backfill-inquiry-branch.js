/**
 * One-time backfill: stamp branchId onto existing inquiries.
 *
 * Custom-cake and corporate inquiries now resolve a fulfilling branch from their
 * city at submit, but inquiries created before that have branchId: null and are
 * visible to the owner only. This maps each such inquiry's city to a branched
 * zone (case-insensitive), falling back to the configured default branch.
 *
 * Safe to re-run: only touches inquiries with no branchId.
 *
 * Usage:
 *   node scripts/backfill-inquiry-branch.js            # apply
 *   node scripts/backfill-inquiry-branch.js --dry-run  # report only, no writes
 */
const mongoose = require('mongoose');
const { validateEnv } = require('../src/config/env');
const connectDB = require('../src/config/db');
const logger = require('../src/middleware/logger');
const CustomCakeInquiry = require('../src/models/CustomCakeInquiry');
const CorporateInquiry = require('../src/models/CorporateInquiry');
const Settings = require('../src/models/Settings');
const { resolveBranchIdForCity } = require('../src/modules/delivery/serviceability');

const NO_BRANCH = { $or: [{ branchId: null }, { branchId: { $exists: false } }] };

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  validateEnv();
  await connectDB();

  const settings = await Settings.findOne({ key: 'global' }).select('defaultBranchId').lean();
  const defaultBranchId = settings?.defaultBranchId || null;
  logger.info(`[backfill-inquiry-branch] default branch: ${defaultBranchId || 'none'}`);

  const models = [['CustomCakeInquiry', CustomCakeInquiry], ['CorporateInquiry', CorporateInquiry]];
  for (const [name, Model] of models) {
    const cities = await Model.distinct('city', NO_BRANCH);
    let updated = 0;
    let unresolved = 0;
    for (const city of cities) {
      const branchId = (await resolveBranchIdForCity(city)) || defaultBranchId;
      const filter = { ...NO_BRANCH, city };
      const count = await Model.countDocuments(filter);
      if (!branchId) { unresolved += count; continue; }
      logger.info(`[backfill-inquiry-branch] ${name} "${city || '(blank)'}" → branch ${branchId} : ${count}`);
      if (!dryRun && count > 0) {
        const res = await Model.updateMany(filter, { $set: { branchId } });
        updated += res.modifiedCount;
      }
    }
    logger.info(`[backfill-inquiry-branch] ${name}: ${dryRun ? 'would update' : 'updated'} ${updated}, ${unresolved} unroutable`);
  }

  if (dryRun) logger.info('[backfill-inquiry-branch] dry run — no changes written');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  logger.error(`[backfill-inquiry-branch] failed: ${err.message}`);
  process.exit(1);
});
