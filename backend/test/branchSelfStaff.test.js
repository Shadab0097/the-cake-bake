const test = require('node:test');
const assert = require('node:assert/strict');

const branchSelf = require('../src/modules/admin/branchSelf.service');

const A = '64b7f9a2c1a2b3d4e5f60711';
const B = '64b7f9a2c1a2b3d4e5f60722';
const C = '64b7f9a2c1a2b3d4e5f60733';

// ── _canManage: who a branch admin may touch ──────────────────────────────
test('_canManage: owner (null scope) may manage staff/managers, never elevated roles', () => {
  assert.equal(branchSelf._canManage(null, { role: 'staff', branchIds: [A] }), true);
  assert.equal(branchSelf._canManage(null, { role: 'manager', branchIds: [] }), true);
  assert.equal(branchSelf._canManage(null, { role: 'admin', branchIds: [] }), false);
  assert.equal(branchSelf._canManage(null, { role: 'superadmin', branchIds: [] }), false);
  assert.equal(branchSelf._canManage(null, { role: 'branchadmin', branchIds: [A] }), false);
});

test('_canManage: walled admin may manage only their own-branch staff/managers', () => {
  const scope = [A];
  assert.equal(branchSelf._canManage(scope, { role: 'staff', branchIds: [A] }), true);
  assert.equal(branchSelf._canManage(scope, { role: 'manager', branchIds: [A] }), true);
});

test('_canManage: walled admin cannot touch another branch (no escalation, no cross-branch)', () => {
  const scope = [A];
  // different branch
  assert.equal(branchSelf._canManage(scope, { role: 'staff', branchIds: [B] }), false);
  // shared with a branch outside scope (superset) — not fully owned
  assert.equal(branchSelf._canManage(scope, { role: 'staff', branchIds: [A, B] }), false);
  // an owner/HQ account (no branches) — never
  assert.equal(branchSelf._canManage(scope, { role: 'manager', branchIds: [] }), false);
  // elevated roles are off-limits regardless of branch
  assert.equal(branchSelf._canManage(scope, { role: 'admin', branchIds: [A] }), false);
  assert.equal(branchSelf._canManage(scope, { role: 'branchadmin', branchIds: [A] }), false);
});

// ── _resolveStaffBranches: where a new/edited staff member is walled to ─────
test('_resolveStaffBranches: single-branch admin auto-assigns their branch', () => {
  assert.deepEqual(branchSelf._resolveStaffBranches([], [A]), [A]);
  assert.deepEqual(branchSelf._resolveStaffBranches([A], [A]), [A]);
});

test('_resolveStaffBranches: a foreign branch request is corrected to the actor’s branch, never honored', () => {
  // requesting B while scoped to A must not place staff in B
  assert.deepEqual(branchSelf._resolveStaffBranches([B], [A]), [A]);
});

test('_resolveStaffBranches: multi-branch admin must pick a valid subset', () => {
  assert.deepEqual(branchSelf._resolveStaffBranches([B], [A, B]), [B]);
  assert.deepEqual(branchSelf._resolveStaffBranches([A, B], [A, B]).sort(), [A, B].sort());
  // no pick across multiple branches => must choose
  assert.throws(() => branchSelf._resolveStaffBranches([], [A, B]), { statusCode: 400 });
  // only-foreign pick across multiple branches => must choose
  assert.throws(() => branchSelf._resolveStaffBranches([C], [A, B]), { statusCode: 400 });
});

test('_resolveStaffBranches: owner (null scope) passes through the requested set', () => {
  assert.deepEqual(branchSelf._resolveStaffBranches([A, B], null), [A, B]);
  assert.deepEqual(branchSelf._resolveStaffBranches([], null), []);
});
