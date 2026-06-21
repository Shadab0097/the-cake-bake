const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'guest-tracking-test-secret';

const guestTrackingService = require('../src/modules/orders/guestTracking.service');

test('guest tracking token round-trips and is bound to its order number', () => {
  const order = {
    _id: '665f00000000000000000001',
    orderNumber: 'TCB-1001',
  };

  const token = guestTrackingService.generateToken(order);
  const decoded = guestTrackingService.verifyToken(token, order.orderNumber);

  assert.equal(decoded.v, 1);
  assert.equal(decoded.oid, order._id);
  assert.equal(decoded.on, order.orderNumber);
  assert.match(decoded.nonce, /^[A-Za-z0-9_-]+$/);
  assert.match(guestTrackingService.hashToken(token), /^[a-f0-9]{64}$/);
});

test('guest tracking token rejects tampering and cross-order replay', () => {
  const order = {
    _id: '665f00000000000000000002',
    orderNumber: 'TCB-1002',
  };
  const token = guestTrackingService.generateToken(order);
  const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

  assert.throws(
    () => guestTrackingService.verifyToken(tamperedToken, order.orderNumber),
    { statusCode: 403 }
  );

  assert.throws(
    () => guestTrackingService.verifyToken(token, 'TCB-9999'),
    { statusCode: 403 }
  );
});

test('guest tracking public order omits sensitive account and token fields', () => {
  const publicOrder = guestTrackingService.buildPublicOrder({
    _id: '665f00000000000000000003',
    orderNumber: 'TCB-1003',
    user: null,
    guestInfo: { name: 'Guest', email: 'guest@example.com', phone: '9999999999' },
    guestTrackingTokenHash: 'secret-hash',
    paymentId: 'payment-internal-id',
    items: [{ name: 'Cake', quantity: 1, price: 50000 }],
    shippingAddress: { fullName: 'Guest', phone: '9999999999' },
    status: 'confirmed',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    total: 50000,
  });

  assert.equal(Object.hasOwn(publicOrder, 'guestInfo'), false);
  assert.equal(Object.hasOwn(publicOrder, 'guestTrackingTokenHash'), false);
  assert.equal(Object.hasOwn(publicOrder, 'paymentId'), false);
  assert.equal(Object.hasOwn(publicOrder, 'user'), false);
  assert.equal(publicOrder.orderNumber, 'TCB-1003');
  assert.equal(publicOrder.items.length, 1);
});

test('normalizeEmail lowercases and trims', () => {
  assert.equal(guestTrackingService.normalizeEmail('  Guest@Example.COM '), 'guest@example.com');
  assert.equal(guestTrackingService.normalizeEmail(null), '');
  assert.equal(guestTrackingService.normalizeEmail(undefined), '');
});

test('escapeRegExp neutralizes regex metacharacters for safe email matching', () => {
  const escaped = guestTrackingService.escapeRegExp('a.b+c*(d)@x.com');
  // Every special char must be backslash-escaped so the value matches literally.
  assert.equal(escaped, 'a\\.b\\+c\\*\\(d\\)@x\\.com');
  const re = new RegExp(`^${escaped}$`, 'i');
  assert.ok(re.test('A.B+C*(d)@X.com'));
  assert.equal(re.test('aXbXcXXdX@xXcom'), false); // dots/plus/star must not act as wildcards
});

test('lookupGuestOrderByEmail returns one generic 404 for blank inputs (enumeration-safe)', async () => {
  await assert.rejects(
    () => guestTrackingService.lookupGuestOrderByEmail('', ''),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, 'GUEST_ORDER_NOT_FOUND');
      return true;
    }
  );

  await assert.rejects(
    () => guestTrackingService.lookupGuestOrderByEmail('TCB-1004', '   '),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, 'GUEST_ORDER_NOT_FOUND');
      return true;
    }
  );
});
