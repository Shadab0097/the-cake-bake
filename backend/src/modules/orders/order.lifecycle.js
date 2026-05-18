const Payment = require('../../models/Payment');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const cache = require('../../utils/cache');
const { sanitize } = require('../../utils/xssSanitizer');
const inventoryReservationService = require('./inventoryReservation.service');
const couponUsageService = require('../coupons/couponUsage.service');
const loyaltyService = require('../loyalty/loyalty.service');

const canMoveOnlineOrderToStatus = (order, nextStatus) => {
  if (order.paymentMethod !== 'online') return true;
  if (order.paymentStatus === 'paid') return true;
  return nextStatus === ORDER_STATUSES.CANCELLED;
};

const restoreRedeemedPoints = async (order, session, reason, eventType = '') => {
  return loyaltyService.restoreForOrder(order, {
    session,
    reason,
    eventType: eventType || loyaltyService.EVENTS.ORDER_PAYMENT_RESTORE,
  });
};

const cancelUnpaidOnlineOrder = async (order, options = {}) => {
  const {
    session,
    paymentStatus = 'failed',
    paymentRecordStatus = PAYMENT_STATUSES.FAILED,
    note = 'Online payment failed',
    paymentEvent = 'payment.failed',
    paymentPayload = {},
    paymentEventId = '',
    razorpayPaymentId = '',
    paymentMethod = '',
  } = options;

  if (!session) throw new Error('cancelUnpaidOnlineOrder requires a mongoose session');
  if (!order || order.paymentMethod !== 'online') return { changed: false, reason: 'not_online' };
  if (order.paymentStatus === 'paid') return { changed: false, reason: 'already_paid' };
  if (order.status !== ORDER_STATUSES.PENDING) return { changed: false, reason: 'not_pending' };
  const safeNote = sanitize(note).slice(0, 500) || 'Online payment failed';

  const payment = await Payment.findOne({ order: order._id }).session(session);
  if (payment?.status === PAYMENT_STATUSES.CAPTURED) {
    return { changed: false, reason: 'payment_captured' };
  }

  if (payment) {
    payment.status = paymentRecordStatus;
    if (razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
    payment.method = paymentMethod || payment.method || 'online';
    const hasEvent = paymentEventId && payment.webhookEvents.some((entry) => entry.eventId === paymentEventId);
    if (!hasEvent) {
      payment.webhookEvents.push({
        eventId: paymentEventId,
        event: paymentEvent,
        payload: paymentPayload,
        receivedAt: new Date(),
      });
    }
    await payment.save({ session });
  }

  order.paymentStatus = paymentStatus;
  order.status = ORDER_STATUSES.CANCELLED;
  order.statusHistory.push({
    status: ORDER_STATUSES.CANCELLED,
    timestamp: new Date(),
    note: safeNote,
  });

  await restoreRedeemedPoints(
    order,
    session,
    `Refunded ${order.pointsRedeemed || 0} points for ${safeNote.toLowerCase()} (${order.orderNumber})`,
    loyaltyService.EVENTS.ORDER_PAYMENT_RESTORE
  );

  await couponUsageService.releaseForOrder(order, session);

  await inventoryReservationService.releaseForOrder(order, session, {
    status: paymentStatus === 'expired' ? 'expired' : 'released',
    reason: safeNote,
  });

  await order.save({ session });
  cache.del('admin:dashboard');

  return { changed: true, order, payment };
};

module.exports = {
  canMoveOnlineOrderToStatus,
  cancelUnpaidOnlineOrder,
  restoreRedeemedPoints,
};
