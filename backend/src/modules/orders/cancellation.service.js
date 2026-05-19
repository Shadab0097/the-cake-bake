const { env } = require('../../config/env');
const { ORDER_STATUSES } = require('../../utils/constants');

const CUSTOMER_CANCELLABLE_STATUSES = new Set([
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.CONFIRMED,
]);

const ADMIN_CANCELLABLE_STATUSES = new Set([
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.CONFIRMED,
  ORDER_STATUSES.PREPARING,
  ORDER_STATUSES.PACKED,
]);

const TERMINAL_STATUSES = new Set([
  ORDER_STATUSES.CANCELLED,
  ORDER_STATUSES.REFUNDED,
  ORDER_STATUSES.DELIVERED,
]);

const hoursUntil = (date, now = new Date()) => {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return (timestamp - new Date(now).getTime()) / (60 * 60 * 1000);
};

const isPaidOnlineOrder = (order) => (
  order?.paymentMethod === 'online' &&
  order?.paymentStatus === 'paid'
);

class CancellationService {
  evaluate(order, options = {}) {
    const {
      actor = 'customer',
      now = new Date(),
      customerCutoffHours = env.cancellation.customerCutoffHours,
    } = options;

    if (!order) {
      return { cancellable: false, code: 'not_found', reason: 'Order not found' };
    }

    if (TERMINAL_STATUSES.has(order.status)) {
      return {
        cancellable: false,
        code: 'terminal_status',
        reason: 'Order cannot be cancelled at this stage',
      };
    }

    const allowedStatuses = actor === 'admin'
      ? ADMIN_CANCELLABLE_STATUSES
      : CUSTOMER_CANCELLABLE_STATUSES;

    if (!allowedStatuses.has(order.status)) {
      return {
        cancellable: false,
        code: 'status_not_cancellable',
        reason: actor === 'admin'
          ? 'Order cannot be cancelled from its current status'
          : 'Order cannot be cancelled once preparation has started',
      };
    }

    if (actor !== 'admin' && order.status === ORDER_STATUSES.CONFIRMED) {
      const remainingHours = hoursUntil(order.deliveryDate, now);
      if (remainingHours < customerCutoffHours) {
        return {
          cancellable: false,
          code: 'customer_cutoff_elapsed',
          reason: `Orders can be cancelled up to ${customerCutoffHours} hours before delivery`,
        };
      }
    }

    return {
      cancellable: true,
      code: 'cancellable',
      reason: '',
      refundRequired: isPaidOnlineOrder(order),
      refundAmount: isPaidOnlineOrder(order) ? order.total : 0,
    };
  }
}

module.exports = new CancellationService();
module.exports.CancellationService = CancellationService;
module.exports.hoursUntil = hoursUntil;
