const test = require('node:test');
const assert = require('node:assert/strict');

const cancellationService = require('../src/modules/orders/cancellation.service');
const { RefundService } = require('../src/modules/payments/refund.service');
const { ORDER_STATUSES, PAYMENT_STATUSES, REFUND_STATUSES } = require('../src/utils/constants');

test('cancellation policy allows customer pending/confirmed orders before cutoff', () => {
  const order = {
    status: ORDER_STATUSES.CONFIRMED,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    total: 120000,
    deliveryDate: new Date('2026-05-20T12:00:00.000Z'),
  };

  const policy = cancellationService.evaluate(order, {
    actor: 'customer',
    now: new Date('2026-05-19T12:00:00.000Z'),
    customerCutoffHours: 12,
  });

  assert.equal(policy.cancellable, true);
  assert.equal(policy.refundRequired, true);
  assert.equal(policy.refundAmount, 120000);
});

test('cancellation policy blocks customer cancellation after preparation or cutoff', () => {
  const preparing = cancellationService.evaluate({
    status: ORDER_STATUSES.PREPARING,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    deliveryDate: new Date('2026-05-20T12:00:00.000Z'),
  }, { actor: 'customer' });

  assert.equal(preparing.cancellable, false);
  assert.equal(preparing.code, 'status_not_cancellable');

  const cutoff = cancellationService.evaluate({
    status: ORDER_STATUSES.CONFIRMED,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    deliveryDate: new Date('2026-05-19T18:00:00.000Z'),
  }, {
    actor: 'customer',
    now: new Date('2026-05-19T12:00:00.000Z'),
    customerCutoffHours: 12,
  });

  assert.equal(cutoff.cancellable, false);
  assert.equal(cutoff.code, 'customer_cutoff_elapsed');
});

test('admin policy can cancel packed orders but not delivered orders', () => {
  const packed = cancellationService.evaluate({
    status: ORDER_STATUSES.PACKED,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
  }, { actor: 'admin' });
  const delivered = cancellationService.evaluate({
    status: ORDER_STATUSES.DELIVERED,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
  }, { actor: 'admin' });

  assert.equal(packed.cancellable, true);
  assert.equal(delivered.cancellable, false);
});

test('refund request is idempotent and updates order/payment refund state', async () => {
  const calls = [];
  const refundService = new RefundService({
    RefundModel: {
      findOneAndUpdate: async (filter, update, options) => {
        calls.push({ filter, update, options });
        return {
          _id: 'refund-id',
          order: filter.order,
          payment: filter.payment,
          status: update.$setOnInsert.status,
          amount: update.$setOnInsert.amount,
        };
      },
    },
  });
  const order = {
    _id: 'order-id',
    user: 'user-id',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    total: 150000,
    saveCalls: 0,
    async save() { this.saveCalls += 1; },
  };
  const payment = {
    _id: 'payment-id',
    status: PAYMENT_STATUSES.CAPTURED,
    currency: 'INR',
    saveCalls: 0,
    async save() { this.saveCalls += 1; },
  };

  const refund = await refundService.requestForOrder({
    order,
    payment,
    amount: 150000,
    reason: 'Customer cancelled paid online order',
    requestedBy: 'customer',
    requestedByUser: 'user-id',
    session: {},
  });

  assert.equal(refund.status, REFUND_STATUSES.REQUESTED);
  assert.equal(calls[0].filter.order, 'order-id');
  assert.equal(calls[0].update.$setOnInsert.amount, 150000);
  assert.equal(payment.refundStatus, REFUND_STATUSES.REQUESTED);
  assert.equal(order.refundStatus, REFUND_STATUSES.REQUESTED);
  assert.equal(payment.saveCalls, 1);
  assert.equal(order.saveCalls, 1);
});

test('refund request rejects non-captured online payments', async () => {
  const refundService = new RefundService({});

  await assert.rejects(
    () => refundService.requestForOrder({
      order: {
        _id: 'order-id',
        paymentMethod: 'online',
        paymentStatus: 'paid',
        total: 100000,
      },
      payment: {
        _id: 'payment-id',
        status: PAYMENT_STATUSES.FAILED,
      },
      amount: 100000,
      session: {},
    }),
    /Only captured online payments/
  );
});

test('successful refund marks refund, payment, and order refunded atomically', async () => {
  const paymentUpdates = [];
  const orderUpdates = [];
  const refund = {
    _id: 'refund-id',
    order: 'order-id',
    payment: 'payment-id',
    amount: 150000,
    events: [],
    async save() {},
  };
  const refundService = new RefundService({
    PaymentModel: {
      updateOne: async (...args) => paymentUpdates.push(args),
    },
    OrderModel: {
      updateOne: async (...args) => orderUpdates.push(args),
    },
  });

  await refundService.markSucceeded({
    refund,
    providerRefund: { id: 'rfnd_123' },
    adminId: 'admin-id',
    session: {},
  });

  assert.equal(refund.status, REFUND_STATUSES.REFUNDED);
  assert.equal(refund.razorpayRefundId, 'rfnd_123');
  assert.equal(paymentUpdates[0][1].$set.status, PAYMENT_STATUSES.REFUNDED);
  assert.equal(paymentUpdates[0][1].$set.refundStatus, REFUND_STATUSES.REFUNDED);
  assert.equal(orderUpdates[0][1].$set.status, ORDER_STATUSES.REFUNDED);
  assert.equal(orderUpdates[0][1].$set.paymentStatus, 'refunded');
});
