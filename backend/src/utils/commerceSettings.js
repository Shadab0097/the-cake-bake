const cache = require('./cache');

// Cached reader for the global Settings.commerce block. Hit on every checkout
// and pincode lookup, so it's cached in-process/Redis and busted explicitly by
// admin updateSettings. Defaults are safe (COD enabled) when unset.
const COMMERCE_CACHE_KEY = 'settings:commerce';

async function getCommerceConfig() {
  return cache.getOrSet(COMMERCE_CACHE_KEY, async () => {
    const Settings = require('../models/Settings');
    const doc = await Settings.findOne({ key: 'global' }).select('commerce defaultBranchId').lean();
    return {
      // Default true so a missing/unset value never silently disables COD.
      codEnabled: doc?.commerce?.codEnabled !== false,
      // Fallback branch for orders that resolve to no zone-branch (null = none).
      defaultBranchId: doc?.defaultBranchId || null,
    };
  }, 300);
}

function bustCommerceConfig() {
  return cache.del(COMMERCE_CACHE_KEY);
}

module.exports = { getCommerceConfig, bustCommerceConfig, COMMERCE_CACHE_KEY };
