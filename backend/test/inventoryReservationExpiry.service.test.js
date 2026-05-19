const test = require('node:test');
const assert = require('node:assert/strict');

const {
  InventoryReservationExpiryService,
  buildExpiredReservationQuery,
  classifyReservationExpiry,
} = require('../src/modules/orders/inventoryReservationExpiry.service');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../src/utils/constants');

const onlinePendingOrder = {
  _id: 'order-id',
  orderNumber: 'TCB-2001',
  paymentMethod: 'online',
  paymentStatus: 'pending',
  status: ORDER_STATUSES.PENDING,
};

test('expired reservation query scans only reserved rows whose expiry has passed', () => {
  const now = new Date('2026-05-19T12:00:00.000Z');
  const { query, limit } = buildExpiredReservationQuery({ now, batchSize: 50 });

  assert.equal(query.status, 'reserved');
  assert.equal(query.expiresAt.$lte.toISOString(), now.toISOString());
  assert.equal(limit, 50);
});

test('reservation expiry classifier protects paid, captured, and provider-uncertain states', () => {
  assert.deepEqual(classifyReservationExpiry({ order: null }), { action: 'expire_orphan' });
  assert.deepEqual(
    classifyReservationExpiry({
      order: { ...onlinePendingOrder, paymentStatus: 'paid' },
      payment: { status: PAYMENT_STATUSES.PENDING },
    }),
    { action: 'confirm_paid' }
  );
  assert.deepEqual(
    classifyReservationExpiry({
      order: onlinePendingOrder,
      payment: { status: PAYMENT_STATUSES.CAPTURED },
    }),
    { action: 'confirm_paid' }
  );
  assert.deepEqual(
    classifyReservationExpiry({
      order: onlinePendingOrder,
      payment: { status: PAYMENT_STATUSES.PENDING },
      reconciliationResult: { status: 'provider_error' },
    }),
    { action: 'skip_provider_uncertain' }
  );
  assert.deepEqual(
    classifyReservationExpiry({
      order: onlinePendingOrder,
      payment: { status: PAYMENT_STATUSES.PENDING },
      reconciliationResult: { status: 'captured_reconciled' },
    }),
    { action: 'skip_captured_repaired' }
  );
  assert.deepEqual(
    classifyReservationExpiry({
      order: onlinePendingOrder,
      payment: { status: PAYMENT_STATUSES.PENDING },
      reconciliationResult: { status: 'authorized_recorded' },
    }),
    { action: 'skip_authorized' }
  );
});

test('reservation expiry classifier identifies safe release paths', () => {
  assert.deepEqual(
    classifyReservationExpiry({
      order: onlinePendingOrder,
      payment: { status: PAYMENT_STATUSES.PENDING },
    }),
    { action: 'expire_unpaid_online' }
  );
  assert.deepEqual(
    classifyReservationExpiry({
      order: {
        ...onlinePendingOrder,
        status: ORDER_STATUSES.CANCELLED,
        paymentStatus: 'expired',
      },
      payment: { status: PAYMENT_STATUSES.EXPIRED },
    }),
    { action: 'release_terminal_unpaid' }
  );
  assert.deepEqual(
    classifyReservationExpiry({
      order: {
        ...onlinePendingOrder,
        paymentMethod: 'cod',
      },
      payment: { status: PAYMENT_STATUSES.PENDING },
    }),
    { action: 'skip_not_online' }
  );
});

test('expireOne skips release when provider reconciliation is uncertain', async () => {
  let executed = false;
  const service = new InventoryReservationExpiryService();
  service.loadContext = async () => ({
    order: onlinePendingOrder,
    payment: { razorpayOrderId: 'order_razorpay', status: PAYMENT_STATUSES.PENDING },
  });
  service.reconcileBeforeExpiry = async () => ({ status: 'provider_error' });
  service.executeAction = async () => {
    executed = true;
  };

  const result = await service.expireOne('reservation-id');

  assert.equal(result.expired, false);
  assert.equal(result.reason, 'skip_provider_uncertain');
  assert.equal(executed, false);
});

test('expireOne skips release when captured reconciliation repaired the order', async () => {
  let executed = false;
  const service = new InventoryReservationExpiryService();
  service.loadContext = async () => ({
    order: onlinePendingOrder,
    payment: { razorpayOrderId: 'order_razorpay', status: PAYMENT_STATUSES.PENDING },
  });
  service.reconcileBeforeExpiry = async () => ({ status: 'captured_reconciled' });
  service.executeAction = async () => {
    executed = true;
  };

  const result = await service.expireOne('reservation-id');

  assert.equal(result.expired, false);
  assert.equal(result.reason, 'skip_captured_repaired');
  assert.equal(executed, false);
});

test('expireOne proceeds when provider failure confirms unpaid expiry path', async () => {
  let executedAction = '';
  const service = new InventoryReservationExpiryService();
  service.loadContext = async () => ({
    order: onlinePendingOrder,
    payment: { razorpayOrderId: 'order_razorpay', status: PAYMENT_STATUSES.PENDING },
  });
  service.reconcileBeforeExpiry = async () => ({ status: 'failed_recorded' });
  service.executeAction = async ({ action }) => {
    executedAction = action;
    return { expired: true, reason: 'order_expired' };
  };

  const result = await service.expireOne('reservation-id');

  assert.equal(result.expired, true);
  assert.equal(result.reason, 'order_expired');
  assert.equal(executedAction, 'expire_unpaid_online');
});
