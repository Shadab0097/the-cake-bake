const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaymentReconciliationService,
  buildCandidateQuery,
  selectProviderPayment,
} = require('../src/modules/payments/paymentReconciliation.service');
const { PAYMENT_STATUSES } = require('../src/utils/constants');

const silentLogger = {
  error() {},
  info() {},
  warn() {},
};

test('provider payment selection prefers latest captured over authorized or failed attempts', () => {
  const selected = selectProviderPayment([
    { id: 'pay_failed', status: 'failed', created_at: 20 },
    { id: 'pay_authorized', status: 'authorized', created_at: 30 },
    { id: 'pay_captured_old', status: 'captured', created_at: 10 },
    { id: 'pay_captured_new', status: 'captured', created_at: 40 },
  ]);

  assert.equal(selected.id, 'pay_captured_new');
  assert.equal(selectProviderPayment([{ id: 'pay_created', status: 'created' }]), null);
  assert.equal(selectProviderPayment(null), null);
});

test('candidate query scans older Razorpay payments inside the configured window', () => {
  const now = new Date('2026-05-19T12:00:00.000Z');
  const { query, limit } = buildCandidateQuery({
    now,
    minAgeMinutes: 15,
    lookbackHours: 48,
    batchSize: 25,
  });

  assert.deepEqual(query.razorpayOrderId, { $type: 'string', $ne: '' });
  assert.deepEqual(query.status.$in, [
    PAYMENT_STATUSES.CREATED,
    PAYMENT_STATUSES.PENDING,
    PAYMENT_STATUSES.AUTHORIZED,
    PAYMENT_STATUSES.FAILED,
    PAYMENT_STATUSES.EXPIRED,
    PAYMENT_STATUSES.CAPTURED,
  ]);
  assert.equal(query.createdAt.$lte.toISOString(), '2026-05-19T11:45:00.000Z');
  assert.equal(query.createdAt.$gte.toISOString(), '2026-05-17T12:00:00.000Z');
  assert.equal(limit, 25);
});

test('captured provider payment is repaired through the transaction-safe payment finalizer', async () => {
  const calls = [];
  const service = new PaymentReconciliationService({
    logger: silentLogger,
    getRazorpayInstance: () => ({
      orders: {
        fetchPayments: async () => ({
          items: [{ id: 'pay_captured', status: 'captured', method: 'upi', created_at: 1 }],
        }),
      },
    }),
    paymentService: {
      reconcileCapturedProviderPayment: async (payment, providerPayment) => {
        calls.push({ payment, providerPayment });
        return { repaired: true, reason: 'captured_reconciled', orderNumber: 'TCB-1001' };
      },
    },
  });

  const payment = {
    _id: 'local-payment',
    order: 'order-id',
    razorpayOrderId: 'order_razorpay',
    status: PAYMENT_STATUSES.PENDING,
  };
  const result = await service.reconcileOne(payment);

  assert.equal(result.status, 'captured_reconciled');
  assert.equal(result.orderNumber, 'TCB-1001');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payment, payment);
  assert.equal(calls[0].providerPayment.id, 'pay_captured');
});

test('authorized provider payment updates only the payment record', async () => {
  const updates = [];
  const events = [];
  const service = new PaymentReconciliationService({
    logger: silentLogger,
    getRazorpayInstance: () => ({
      orders: {
        fetchPayments: async () => ({
          items: [{ id: 'pay_authorized', status: 'authorized', method: 'card', created_at: 1 }],
        }),
      },
    }),
    PaymentModel: {
      findOneAndUpdate: async (filter, update) => {
        updates.push({ filter, update });
        return { _id: filter._id };
      },
    },
    paymentService: {
      recordPaymentWebhookEvent: async (...args) => {
        events.push(args);
      },
    },
  });

  const result = await service.reconcileOne({
    _id: 'local-payment',
    razorpayOrderId: 'order_razorpay',
    status: PAYMENT_STATUSES.PENDING,
  });

  assert.equal(result.status, 'authorized_recorded');
  assert.equal(updates[0].update.$set.status, PAYMENT_STATUSES.AUTHORIZED);
  assert.equal(updates[0].update.$set.razorpayPaymentId, 'pay_authorized');
  assert.equal(events[0][1], 'reconciliation:authorized:pay_authorized');
  assert.equal(events[0][2], 'payment.reconciled_authorized');
});

test('failed provider payment records failed state without finalizing or cancelling order', async () => {
  const updates = [];
  let capturedRepairCalled = false;
  const service = new PaymentReconciliationService({
    logger: silentLogger,
    getRazorpayInstance: () => ({
      orders: {
        fetchPayments: async () => ({
          items: [{ id: 'pay_failed', status: 'failed', method: 'netbanking', created_at: 1 }],
        }),
      },
    }),
    PaymentModel: {
      findOneAndUpdate: async (filter, update) => {
        updates.push({ filter, update });
        return { _id: filter._id };
      },
    },
    paymentService: {
      recordPaymentWebhookEvent: async () => {},
      reconcileCapturedProviderPayment: async () => {
        capturedRepairCalled = true;
      },
    },
  });

  const result = await service.reconcileOne({
    _id: 'local-payment',
    razorpayOrderId: 'order_razorpay',
    status: PAYMENT_STATUSES.PENDING,
  });

  assert.equal(result.status, 'failed_recorded');
  assert.equal(updates[0].update.$set.status, PAYMENT_STATUSES.FAILED);
  assert.equal(updates[0].update.$set.razorpayPaymentId, 'pay_failed');
  assert.equal(capturedRepairCalled, false);
});

test('provider lookup errors are isolated to the candidate payment', async () => {
  const service = new PaymentReconciliationService({
    logger: silentLogger,
    getRazorpayInstance: () => ({
      orders: {
        fetchPayments: async () => {
          throw new Error('provider unavailable');
        },
      },
    }),
  });

  const result = await service.reconcileOne({
    _id: 'local-payment',
    razorpayOrderId: 'order_razorpay',
    status: PAYMENT_STATUSES.PENDING,
  });

  assert.equal(result.status, 'provider_error');
  assert.equal(result.reason, 'provider unavailable');
});
