const test = require('node:test');
const assert = require('node:assert/strict');

const Cart = require('../src/models/Cart');
const ChatbotLog = require('../src/models/ChatbotLog');
const Coupon = require('../src/models/Coupon');
const CouponUsage = require('../src/models/CouponUsage');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');
const Product = require('../src/models/Product');
const Refund = require('../src/models/Refund');
const User = require('../src/models/User');
const Variant = require('../src/models/Variant');

const indexesFor = (model) => model.schema.indexes();

const sameKeys = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

const hasIndex = (model, expectedKeys, optionsPredicate = () => true) => {
  return indexesFor(model).some(([keys, options]) => (
    sameKeys(keys, expectedKeys) && optionsPredicate(options || {})
  ));
};

const hasIndexPrefix = (model, expectedPrefix) => {
  const prefixEntries = Object.entries(expectedPrefix);
  return indexesFor(model).some(([keys]) => {
    const entries = Object.entries(keys);
    return prefixEntries.every(([field, direction], index) => (
      entries[index]?.[0] === field && entries[index]?.[1] === direction
    ));
  });
};

test('order indexes cover account, admin status, payment status, and guest tracking lookups', () => {
  assert.equal(hasIndex(Order, { user: 1, createdAt: -1 }), true);
  assert.equal(hasIndex(Order, { orderNumber: 1 }, (options) => options.unique === true), true);
  assert.equal(hasIndex(Order, { status: 1, createdAt: -1 }), true);
  assert.equal(hasIndex(Order, { paymentStatus: 1, createdAt: -1 }), true);
  assert.equal(hasIndex(Order, { refundStatus: 1 }), true);
  assert.equal(hasIndex(Order, { paymentMethod: 1, 'codRisk.normalizedPhone': 1, createdAt: -1 }), true);
  assert.equal(hasIndex(Order, { paymentMethod: 1, checkoutIp: 1, createdAt: -1 }), true);
  assert.equal(hasIndex(Order, { paymentMethod: 1, 'codRisk.addressHash': 1, status: 1, createdAt: -1 }), true);
  assert.equal(
    hasIndex(Order, { guestTrackingTokenHash: 1 }, (options) => (
      options.unique === true &&
      options.partialFilterExpression?.guestTrackingTokenHash?.$gt === ''
    )),
    true
  );
});

test('payment indexes cover Razorpay lookup and reconciliation scans', () => {
  assert.equal(
    hasIndex(Payment, { razorpayOrderId: 1 }, (options) => (
      options.partialFilterExpression?.razorpayOrderId?.$gt === ''
    )),
    true
  );
  assert.equal(
    hasIndex(Payment, { razorpayPaymentId: 1 }, (options) => (
      options.partialFilterExpression?.razorpayPaymentId?.$gt === ''
    )),
    true
  );
  assert.equal(hasIndex(Payment, { status: 1, createdAt: 1 }), true);
  assert.equal(hasIndex(Payment, { refundStatus: 1 }), true);
});

test('catalog and cart indexes cover public product and cart access patterns', () => {
  assert.equal(hasIndex(Product, { slug: 1 }, (options) => options.unique === true), true);
  assert.equal(hasIndexPrefix(Product, { category: 1, isActive: 1 }), true);
  assert.equal(hasIndex(Product, { flavors: 1, isActive: 1 }), true);
  assert.equal(hasIndex(Product, { cities: 1, isActive: 1 }), true);
  assert.equal(hasIndex(Variant, { product: 1, isActive: 1 }), true);
  assert.equal(hasIndex(Variant, { isActive: 1, stock: 1, product: 1 }), true);
  assert.equal(hasIndex(Cart, { user: 1 }, (options) => options.unique === true), true);
  assert.equal(hasIndex(User, { codDisabled: 1 }), true);
});

test('coupon and chatbot indexes cover validation and support history lookups', () => {
  assert.equal(hasIndex(Coupon, { code: 1 }, (options) => options.unique === true), true);
  assert.equal(hasIndex(CouponUsage, { coupon: 1, user: 1 }), true);
  assert.equal(hasIndex(ChatbotLog, { senderPhone: 1, createdAt: -1 }), true);
});

test('refund workflow indexes cover unique order/payment refunds and admin queues', () => {
  assert.equal(hasIndex(Refund, { order: 1, payment: 1 }, (options) => options.unique === true), true);
  assert.equal(hasIndex(Refund, { status: 1, createdAt: -1 }), true);
  assert.equal(
    hasIndex(Refund, { razorpayRefundId: 1 }, (options) => (
      options.partialFilterExpression?.razorpayRefundId?.$gt === ''
    )),
    true
  );
});
