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
