const test = require('node:test');
const assert = require('node:assert/strict');

const { CouponUsageService } = require('../src/modules/coupons/couponUsage.service');

test('coupon usage service normalizes codes, guest identities, and discount caps', () => {
  const service = new CouponUsageService();

  assert.equal(service.normalizeCode(' save10 '), 'SAVE10');
  assert.equal(service.normalizeEmail(' Guest@Example.COM '), 'guest@example.com');
  assert.equal(service.normalizePhone('+91 98765-01234'), '919876501234');
  assert.deepEqual(service.getIdentities({
    guestInfo: {
      email: ' Guest@Example.COM ',
      phone: '+91 98765-01234',
    },
  }), [
    { identityType: 'guest_email', identityKey: 'guest@example.com', guestEmail: 'guest@example.com' },
    { identityType: 'guest_phone', identityKey: '919876501234', guestPhone: '919876501234' },
  ]);
  assert.equal(service.calculateDiscount({
    type: 'percentage',
    value: 20,
    minOrderAmount: 50000,
    maxDiscount: 15000,
  }, 100000), 15000);
  assert.equal(service.calculateDiscount({ type: 'flat', value: 10000, minOrderAmount: 0 }, 50000), 10000);
});

test('coupon usage service uses user identity ahead of guest details', () => {
  const service = new CouponUsageService();

  assert.deepEqual(service.getIdentities({
    userId: 'user-id',
    guestInfo: {
      email: 'guest@example.com',
      phone: '9999999999',
    },
  }), [
    { identityType: 'user', identityKey: 'user-id', user: 'user-id' },
  ]);
});
