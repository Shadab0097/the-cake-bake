const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const DeliveryZone = require('../src/models/DeliveryZone');
const {
  computeScope,
  resolveBranchIds,
  toObjectIds,
  withBranch,
  orderBranchMatch,
} = require('../src/utils/branchScope');

// Two distinct branch ids used throughout: A = "my" branch, B = "other" branch.
const A = '64b7f9a2c1a2b3d4e5f60711';
const B = '64b7f9a2c1a2b3d4e5f60722';

// ── computeScope: the owner vs. walled determination ──────────────────────
test('computeScope: absent/empty branchIds => owner (global, sees all)', () => {
  assert.deepEqual(computeScope({}), { global: true, branchIds: null });
  assert.deepEqual(computeScope({ branchIds: [] }), { global: true, branchIds: null });
  assert.deepEqual(computeScope(null), { global: true, branchIds: null });
});

test('computeScope: one+ branchIds => walled to exactly that set', () => {
  const s = computeScope({ branchIds: [A, B] });
  assert.equal(s.global, false);
  assert.deepEqual(s.branchIds, [A, B]);
});

// ── resolveBranchIds: the cross-branch firewall ───────────────────────────
test('resolveBranchIds: owner defaults to all, may filter to any branch', () => {
  const owner = computeScope({});
  assert.equal(resolveBranchIds(owner), null); // null = no constraint = all branches
  assert.deepEqual(resolveBranchIds(owner, A), [A]);
  assert.deepEqual(resolveBranchIds(owner, B), [B]);
});

test('resolveBranchIds: walled admin defaults to their own set', () => {
  const walled = computeScope({ branchIds: [A] });
  assert.deepEqual(resolveBranchIds(walled), [A]);
  assert.deepEqual(resolveBranchIds(walled, A), [A]); // picking own branch is fine
});

test('resolveBranchIds: walled admin requesting another branch => hard 403', () => {
  const walled = computeScope({ branchIds: [A] });
  assert.throws(() => resolveBranchIds(walled, B), { statusCode: 403 });
});

test('resolveBranchIds: junk/empty request never widens a walled admin', () => {
  const walled = computeScope({ branchIds: [A] });
  assert.deepEqual(resolveBranchIds(walled, 'not-an-object-id'), [A]);
  assert.deepEqual(resolveBranchIds(walled, ''), [A]);
  assert.deepEqual(resolveBranchIds(walled, undefined), [A]);
});

// ── toObjectIds: normalize / dedupe / reject junk ─────────────────────────
test('toObjectIds: dedupes, drops invalid, empty => no constraint', () => {
  assert.equal(toObjectIds({}).length, 0);
  assert.equal(toObjectIds({ branchIds: [] }).length, 0);
  const ids = toObjectIds({ branchIds: [A, A, 'junk', ''] });
  assert.equal(ids.length, 1);
  assert.ok(ids[0] instanceof mongoose.Types.ObjectId);
  assert.equal(String(ids[0]), A);
  assert.equal(toObjectIds({ branchId: A }).length, 1); // single form
});

// ── withBranch: must AND, never widen by dropping an $or ──────────────────
test('withBranch: empty fragment is a no-op', () => {
  const base = { paymentStatus: 'paid' };
  assert.deepEqual(withBranch(base, {}), base);
  assert.deepEqual(withBranch(base, undefined), base);
});

test('withBranch: combines via $and, preserving BOTH $or clauses (no leak)', () => {
  const base = { $or: [{ paymentMethod: 'cod' }, { paymentMethod: 'online' }] };
  const frag = { $or: [{ branchId: { $in: [A] } }, { branchId: null }] };
  const merged = withBranch(base, frag);
  assert.deepEqual(merged, { $and: [base, frag] });
  // Spreading would have collapsed two $ors into one and widened the query;
  // $and keeps both as independent required conditions.
  assert.equal(merged.$and.length, 2);
  assert.ok(merged.$and[0].$or && merged.$and[1].$or);
});

// ── orderBranchMatch: the hybrid (snapshot branchId OR legacy city) ───────
test('orderBranchMatch: empty/owner => {} (no branch constraint)', async () => {
  assert.deepEqual(await orderBranchMatch([]), {});
  assert.deepEqual(await orderBranchMatch(null), {});
});

test('orderBranchMatch: walled => snapshot branchId OR legacy deliveryCity', async (t) => {
  const original = DeliveryZone.find;
  DeliveryZone.find = () => ({ select: () => ({ lean: async () => [{ city: 'Gurgaon' }, { city: 'Manesar' }] }) });
  t.after(() => { DeliveryZone.find = original; });

  const m = await orderBranchMatch([A]);
  assert.ok(Array.isArray(m.$or) && m.$or.length === 2);
  assert.ok(m.$or[0].branchId.$in, 'first clause matches snapshotted branchId');
  assert.equal(m.$or[1].branchId, null, 'second clause is legacy (no branch)');
  assert.deepEqual(m.$or[1].deliveryCity.$in, ['Gurgaon', 'Manesar']);
});

test('orderBranchMatch: branch with no zones => branchId-only (no city clause)', async (t) => {
  const original = DeliveryZone.find;
  DeliveryZone.find = () => ({ select: () => ({ lean: async () => [] }) });
  t.after(() => { DeliveryZone.find = original; });

  const m = await orderBranchMatch([A]);
  assert.ok(m.branchId.$in);
  assert.equal(m.$or, undefined);
});
