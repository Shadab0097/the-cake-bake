const InventoryReservation = require('../../models/InventoryReservation');
const Variant = require('../../models/Variant');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');

const buildReservationItems = (items) => items
  .filter((item) => item.variant)
  .map((item) => ({
    product: item.product || null,
    variant: item.variant,
    weight: item.weight || '',
    quantity: item.quantity,
  }));

class InventoryReservationService {
  async reserveForOrder({ order, items, user = null, guestInfo = {}, status = 'reserved', expiresAt = null, reason = '', session }) {
    if (!session) throw new Error('reserveForOrder requires a mongoose session');

    const reservationItems = buildReservationItems(items);
    if (reservationItems.length === 0) {
      throw ApiError.badRequest('Order has no reservable inventory items');
    }

    const bulkOps = reservationItems.map((item) => ({
      updateOne: {
        filter: { _id: item.variant, isActive: true, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity } },
      },
    }));

    const result = await Variant.bulkWrite(bulkOps, { session, ordered: true });
    if (result.modifiedCount !== bulkOps.length) {
      logger.warn(`[InventoryReservation] Stock reservation failed for order ${order.orderNumber}: expected=${bulkOps.length} modified=${result.modifiedCount}`);
      throw ApiError.badRequest('Some items are no longer available in the requested quantity. Please refresh your cart and try again.');
    }

    const now = new Date();
    const reservation = await InventoryReservation.create([{
      order: order._id,
      user,
      guestEmail: guestInfo.email || '',
      guestPhone: guestInfo.phone || '',
      items: reservationItems,
      status,
      expiresAt,
      confirmedAt: status === 'confirmed' ? now : undefined,
      reason,
    }], { session });

    return reservation[0];
  }

  async confirmForOrder(orderOrId, session) {
    if (!session) throw new Error('confirmForOrder requires a mongoose session');

    const orderId = orderOrId?._id || orderOrId;
    const reservation = await InventoryReservation.findOne({ order: orderId }).session(session);
    if (!reservation && orderOrId?.items) {
      if (orderOrId.paymentStatus === 'paid') {
        const legacyConfirmedReservation = await InventoryReservation.create([{
          order: orderOrId._id,
          user: orderOrId.user || null,
          guestEmail: orderOrId.guestInfo?.email || '',
          guestPhone: orderOrId.guestInfo?.phone || '',
          items: buildReservationItems(orderOrId.items),
          status: 'confirmed',
          confirmedAt: new Date(),
          reason: 'Legacy paid order reconciliation',
        }], { session });

        return { changed: true, reservation: legacyConfirmedReservation[0] };
      }

      const legacyReservation = await this.reserveForOrder({
        order: orderOrId,
        items: orderOrId.items,
        user: orderOrId.user || null,
        guestInfo: orderOrId.guestInfo || {},
        status: 'confirmed',
        reason: 'Payment captured',
        session,
      });
      return { changed: true, reservation: legacyReservation };
    }

    if (!reservation) {
      throw ApiError.badRequest('Inventory reservation was not found for this order. Please contact support.');
    }

    if (reservation.status === 'confirmed') return { changed: false, reservation };

    if (reservation.status === 'released' || reservation.status === 'expired') {
      if (!orderOrId?.items) {
        throw ApiError.badRequest('Inventory reservation is no longer active for this payment. Please contact support.');
      }

      const reservationItems = buildReservationItems(orderOrId.items);
      const bulkOps = reservationItems.map((item) => ({
        updateOne: {
          filter: { _id: item.variant, isActive: true, stock: { $gte: item.quantity } },
          update: { $inc: { stock: -item.quantity } },
        },
      }));

      const result = await Variant.bulkWrite(bulkOps, { session, ordered: true });
      if (result.modifiedCount !== bulkOps.length) {
        logger.warn(`[InventoryReservation] Re-reservation failed for order ${orderOrId.orderNumber}: expected=${bulkOps.length} modified=${result.modifiedCount}`);
        throw ApiError.badRequest('Payment was captured but inventory is no longer available. Please contact support for refund or fulfillment review.');
      }

      reservation.items = reservationItems;
    } else if (reservation.status !== 'reserved') {
      throw ApiError.badRequest('Inventory reservation is no longer active for this payment. Please contact support.');
    }

    reservation.status = 'confirmed';
    reservation.confirmedAt = new Date();
    reservation.reason = 'Payment captured';
    await reservation.save({ session });

    return { changed: true, reservation };
  }

  async releaseForOrder(orderOrId, session, options = {}) {
    if (!session) throw new Error('releaseForOrder requires a mongoose session');

    const { status = 'released', reason = 'Inventory reservation released' } = options;
    const orderId = orderOrId?._id || orderOrId;
    const reservation = await InventoryReservation.findOne({ order: orderId }).session(session);
    if (!reservation) {
      if (
        orderOrId?.items &&
        (orderOrId.paymentMethod !== 'online' || orderOrId.paymentStatus === 'paid')
      ) {
        const fallbackItems = buildReservationItems(orderOrId.items);
        const fallbackOps = fallbackItems.map((item) => ({
          updateOne: {
            filter: { _id: item.variant },
            update: { $inc: { stock: item.quantity } },
          },
        }));

        if (fallbackOps.length > 0) {
          await Variant.bulkWrite(fallbackOps, { session, ordered: true });
        }

        return { changed: true, reason: 'legacy_released' };
      }

      return { changed: false, reason: 'not_found' };
    }

    if (reservation.status === 'released' || reservation.status === 'expired') {
      return { changed: false, reason: reservation.status, reservation };
    }

    const bulkOps = reservation.items.map((item) => ({
      updateOne: {
        filter: { _id: item.variant },
        update: { $inc: { stock: item.quantity } },
      },
    }));

    if (bulkOps.length > 0) {
      await Variant.bulkWrite(bulkOps, { session, ordered: true });
    }

    reservation.status = status;
    reservation.releasedAt = new Date();
    reservation.reason = reason;
    await reservation.save({ session });

    return { changed: true, reservation };
  }
}

module.exports = new InventoryReservationService();
