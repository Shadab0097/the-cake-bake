const mongoose = require('mongoose');
const ApiError = require('./ApiError');

/**
 * Branch data-scope for an admin request — the single source of truth for
 * "which branches may this user read/write". Enforced server-side so the UI can
 * never be the security boundary.
 *
 *   Owner / HQ  -> no branchIds      -> sees every branch (and future ones).
 *   Scoped admin -> one+ branchIds   -> walled to exactly that set.
 *
 * Orthogonal to `role` (which gates which features/sections a user can touch).
 */

// Build the scope object from the authenticated admin user. Empty/absent
// branchIds => owner (global). One or more => walled to that set.
function computeScope(user) {
  const ids = Array.isArray(user && user.branchIds)
    ? user.branchIds.filter(Boolean).map((id) => String(id))
    : [];
  return ids.length ? { global: false, branchIds: ids } : { global: true, branchIds: null };
}

// Normalize a single requested branchId (from ?branchId=) to a hex string, or
// null when absent/invalid. Invalid junk is treated as "not requested".
function normalizeId(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v);
  return mongoose.Types.ObjectId.isValid(s) ? s : null;
}

/**
 * Resolve the effective branchId set for a request, honoring an optional
 * requested branchId (the ?branchId= dropdown pick).
 *   - owner: returns [requested] if asked, else null (= all branches).
 *   - scoped: a request OUTSIDE their set is a hard 403 (never a silent leak);
 *     an absent/invalid request returns their full set.
 * @returns {string[]|null} one+ ids, or null = no branch constraint (all).
 */
function resolveBranchIds(scope, requestedBranchId) {
  const requested = normalizeId(requestedBranchId);
  if (!scope || scope.global) {
    return requested ? [requested] : null;
  }
  if (requested) {
    if (!scope.branchIds.includes(requested)) {
      throw ApiError.forbidden('You do not have access to this branch');
    }
    return [requested];
  }
  return scope.branchIds;
}

/**
 * Normalize a query carrying either `branchIds` (array — from the scope-resolving
 * controller) or a single `branchId` (internal callers like report.service) into
 * a deduped ObjectId[]. Invalid ids are dropped. Empty => no branch constraint.
 */
function toObjectIds(query = {}) {
  const raw = Array.isArray(query.branchIds)
    ? query.branchIds
    : (query.branchId !== undefined && query.branchId !== null && query.branchId !== ''
      ? [query.branchId]
      : []);
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    const s = String(id);
    if (mongoose.Types.ObjectId.isValid(s) && !seen.has(s)) {
      seen.add(s);
      out.push(new mongoose.Types.ObjectId(s));
    }
  }
  return out;
}

/**
 * Safely AND a branch match fragment onto a base filter. Both the base and the
 * fragment may carry their own `$or` (e.g. payment-method OR, plus the branch
 * hybrid OR), so we combine with `$and` rather than spreading — spreading would
 * silently drop one `$or` and widen the query (a data leak). Empty fragment is a
 * no-op (owner / global).
 */
function withBranch(base, branchMatch) {
  if (!branchMatch || !Object.keys(branchMatch).length) return base;
  return { $and: [base, branchMatch] };
}

/**
 * Mongo match fragment for Order-derived collections, scoped to branchIds.
 * Hybrid: snapshotted branchId OR legacy orders (no snapshot) whose deliveryCity
 * belongs to one of those branches' zones — so pre-snapshot history still
 * attributes correctly. ids null/empty => {} (no constraint, owner sees all).
 */
async function orderBranchMatch(ids, options = {}) {
  if (!ids || !ids.length) return {};
  const { session = null } = options;
  const DeliveryZone = require('../models/DeliveryZone');
  const objIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  let q = DeliveryZone.find({ branchId: { $in: objIds } }).select('city').lean();
  if (session) q = q.session(session);
  const zones = await q;
  const cities = [...new Set(zones.map((z) => z.city).filter(Boolean))];
  return cities.length
    ? { $or: [{ branchId: { $in: objIds } }, { branchId: null, deliveryCity: { $in: cities } }] }
    : { branchId: { $in: objIds } };
}

module.exports = { computeScope, normalizeId, resolveBranchIds, toObjectIds, withBranch, orderBranchMatch };
