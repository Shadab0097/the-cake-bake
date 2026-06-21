const test = require('node:test');
const assert = require('node:assert/strict');

const Coupon = require('../src/models/Coupon');
const couponUsage = require('../src/modules/coupons/couponUsage.service');
const couponService = require('../src/modules/coupons/coupon.service');

const A = '64b7f9a2c1a2b3d4e5f60711';
const B = '64b7f9a2c1a2b3d4e5f60722';

// ── Checkout enforcement: a branch-owned coupon never applies cross-branch ──
test('findValidCoupon: preview (no branch context) is unrestricted', async (t) => {
  let criteria;
  const orig = Coupon.findOne;
  Coupon.findOne = (c) => { criteria = c; return { session: () => null }; };
  t.after(() => { Coupon.findOne = orig; });

  await couponUsage.findValidCoupon('SAVE', 100);
  assert.equal(criteria.$or, undefined);
});

test('findValidCoupon: checkout with a branch => chain-wide OR that branch only', async (t) => {
  let criteria;
  const orig = Coupon.findOne;
  Coupon.findOne = (c) => { criteria = c; return { session: () => null }; };
  t.after(() => { Coupon.findOne = orig; });

  await couponUsage.findValidCoupon('SAVE', 100, null, A);
  assert.deepEqual(criteria.$or, [{ branchId: null }, { branchId: A }]);
});

test('findValidCoupon: checkout with no resolved branch => chain-wide only', async (t) => {
  let criteria;
  const orig = Coupon.findOne;
  Coupon.findOne = (c) => { criteria = c; return { session: () => null }; };
  t.after(() => { Coupon.findOne = orig; });

  await couponUsage.findValidCoupon('SAVE', 100, null, null);
  assert.deepEqual(criteria.$or, [{ branchId: null }]);
});

// ── Admin authoring: a walled creator can't escape their own branch ─────────
test('createCoupon: walled creator targeting a foreign branch is rejected', async () => {
  await assert.rejects(
    () => couponService.createCoupon({ code: 'x', type: 'percentage', value: 5, branchId: B }, [A]),
    { statusCode: 400 }
  );
});

test('createCoupon: walled single-branch creator is auto-assigned their branch', async (t) => {
  let created;
  const origFind = Coupon.findOne;
  const origCreate = Coupon.create;
  Coupon.findOne = async () => null; // no existing code
  Coupon.create = async (data) => { created = data; return data; };
  t.after(() => { Coupon.findOne = origFind; Coupon.create = origCreate; });

  await couponService.createCoupon({ code: 'x', type: 'percentage', value: 5 }, [A]);
  assert.equal(created.branchId, A);
});

test('createCoupon: owner may create a chain-wide coupon (branchId null)', async (t) => {
  let created;
  const origFind = Coupon.findOne;
  const origCreate = Coupon.create;
  Coupon.findOne = async () => null;
  Coupon.create = async (data) => { created = data; return data; };
  t.after(() => { Coupon.findOne = origFind; Coupon.create = origCreate; });

  await couponService.createCoupon({ code: 'x', type: 'percentage', value: 5 }, null);
  assert.equal(created.branchId, null);
});
