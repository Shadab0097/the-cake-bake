const test = require('node:test');
const assert = require('node:assert/strict');

const { EVENTS, LoyaltyService } = require('../src/modules/loyalty/loyalty.service');

test('loyalty point normalization truncates invalid and fractional values safely', () => {
  const service = new LoyaltyService();

  assert.equal(service.normalizePoints('120.9'), 120);
  assert.equal(service.normalizePoints(-4.7), -4);
  assert.equal(service.normalizePoints('invalid'), 0);
  assert.equal(service.normalizePoints(undefined), 0);
});

test('loyalty event names are stable for redemption, restoration, reapply, and earn idempotency', () => {
  assert.deepEqual(EVENTS, {
    ORDER_CREATED_REDEEM: 'order_created_redeem',
    ORDER_PAYMENT_RESTORE: 'order_payment_restore',
    ORDER_CAPTURED_REAPPLY: 'order_captured_reapply',
    ORDER_CANCELLED_RESTORE: 'order_cancelled_restore',
    ORDER_DELIVERED_EARN: 'order_delivered_earn',
  });
});
