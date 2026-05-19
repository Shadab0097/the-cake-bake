const User = require('../../models/User');
const LoyaltyPoints = require('../../models/LoyaltyPoints');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const { LOYALTY_TYPES } = require('../../utils/constants');

const EVENTS = {
  ORDER_CREATED_REDEEM: 'order_created_redeem',
  ORDER_PAYMENT_RESTORE: 'order_payment_restore',
  ORDER_CAPTURED_REAPPLY: 'order_captured_reapply',
  ORDER_CANCELLED_RESTORE: 'order_cancelled_restore',
  ORDER_DELIVERED_EARN: 'order_delivered_earn',
};

const LEGACY_PAYMENT_RESTORE_EVENTS = [
  'order_failed_restore',
  'order_expired_restore',
  'order_cancelled_restore',
];

const PAYMENT_RESTORE_EVENT_TYPES = [
  EVENTS.ORDER_PAYMENT_RESTORE,
  ...LEGACY_PAYMENT_RESTORE_EVENTS,
];

class LoyaltyService {
  constructor() {
    this.EVENTS = EVENTS;
  }

  normalizePoints(points) {
    const normalized = Number(points);
    return Number.isFinite(normalized) ? Math.trunc(normalized) : 0;
  }

  async calculateRedemption({ userId, redeemPoints, prePointsTotal, session = null }) {
    if (!redeemPoints || !userId) return { pointsRedeemed: 0, pointsDiscount: 0 };

    const redeemableTotal = Math.max(0, this.normalizePoints(prePointsTotal));
    if (redeemableTotal <= 0 || env.loyalty.pointValue <= 0) {
      return { pointsRedeemed: 0, pointsDiscount: 0 };
    }

    const query = User.findById(userId).select('loyaltyPoints');
    const user = session ? await query.session(session) : await query;
    if (!user) throw ApiError.notFound('User not found');

    const userBalance = Math.max(0, this.normalizePoints(user.loyaltyPoints));
    if (userBalance < env.loyalty.minRedeem) {
      return { pointsRedeemed: 0, pointsDiscount: 0 };
    }

    const maxPointsDiscount = Math.floor(redeemableTotal * env.loyalty.maxRedeemPercent / 100);
    const maxRedeemablePoints = Math.floor(maxPointsDiscount / env.loyalty.pointValue);
    const pointsRedeemed = Math.min(userBalance, maxRedeemablePoints);
    const pointsDiscount = pointsRedeemed * env.loyalty.pointValue;

    return { pointsRedeemed, pointsDiscount };
  }

  async createLedgerOnce({ userId, type, points, source = 'order', referenceId, eventType, description, session }) {
    if (!session) throw new Error('createLedgerOnce requires a mongoose session');
    if (!userId || !referenceId || !eventType) {
      throw new Error('createLedgerOnce requires userId, referenceId, and eventType');
    }

    try {
      const result = await LoyaltyPoints.updateOne(
        {
          user: userId,
          referenceId,
          eventType,
        },
        {
          $setOnInsert: {
            user: userId,
            type,
            points,
            source,
            referenceId,
            eventType,
            description,
          },
        },
        { session, upsert: true, runValidators: true }
      );

      return { inserted: result.upsertedCount === 1 };
    } catch (error) {
      if (error.code === 11000) return { inserted: false };
      throw error;
    }
  }

  async redeemForOrder({ userId, pointsRedeemed, orderId, orderNumber, session }) {
    const points = this.normalizePoints(pointsRedeemed);
    if (!points || points <= 0 || !userId) return { changed: false, reason: 'no_points' };
    if (!session) throw new Error('redeemForOrder requires a mongoose session');

    const ledger = await this.createLedgerOnce({
      userId,
      type: LOYALTY_TYPES.REDEEMED,
      points: -points,
      source: 'order',
      referenceId: orderId,
      eventType: EVENTS.ORDER_CREATED_REDEEM,
      description: `Redeemed ${points} points for order ${orderNumber}`,
      session,
    });

    if (!ledger.inserted) return { changed: false, reason: 'already_redeemed' };

    const updateResult = await User.updateOne(
      { _id: userId, loyaltyPoints: { $gte: points } },
      { $inc: { loyaltyPoints: -points } },
      { session }
    );

    if (updateResult.modifiedCount !== 1) {
      throw ApiError.badRequest('Loyalty point balance changed. Please review your cart and try again.');
    }

    return { changed: true };
  }

  async hasPaymentRestore(order, session) {
    if (!order?.user || !order?._id) return false;

    const restore = await LoyaltyPoints.findOne({
      user: order.user,
      referenceId: order._id,
      eventType: { $in: PAYMENT_RESTORE_EVENT_TYPES },
      points: { $gt: 0 },
    }).session(session).lean();

    return Boolean(restore);
  }

  async restoreForOrder(order, { session, eventType = EVENTS.ORDER_PAYMENT_RESTORE, reason = '' } = {}) {
    const points = this.normalizePoints(order?.pointsRedeemed);
    if (!order?.user || !points || points <= 0) return { changed: false, reason: 'no_points' };
    if (!session) throw new Error('restoreForOrder requires a mongoose session');

    if (eventType === EVENTS.ORDER_PAYMENT_RESTORE && await this.hasPaymentRestore(order, session)) {
      return { changed: false, reason: 'already_restored' };
    }

    const description = reason || `Restored ${points} points for order ${order.orderNumber}`;
    const ledger = await this.createLedgerOnce({
      userId: order.user,
      type: LOYALTY_TYPES.ADJUSTED,
      points,
      source: 'order',
      referenceId: order._id,
      eventType,
      description,
      session,
    });

    if (!ledger.inserted) return { changed: false, reason: 'already_restored' };

    const restoreResult = await User.updateOne(
      { _id: order.user },
      { $inc: { loyaltyPoints: points } },
      { session }
    );
    if (restoreResult.modifiedCount !== 1) {
      throw ApiError.notFound('Customer not found for loyalty restoration');
    }

    return { changed: true };
  }

  async reapplyRestoredRedemptionForCapture(order, { session } = {}) {
    const points = this.normalizePoints(order?.pointsRedeemed);
    if (!order?.user || !points || points <= 0) return { changed: false, reason: 'no_points' };
    if (!session) throw new Error('reapplyRestoredRedemptionForCapture requires a mongoose session');

    if (!await this.hasPaymentRestore(order, session)) {
      return { changed: false, reason: 'not_restored' };
    }

    const ledger = await this.createLedgerOnce({
      userId: order.user,
      type: LOYALTY_TYPES.ADJUSTED,
      points: -points,
      source: 'order',
      referenceId: order._id,
      eventType: EVENTS.ORDER_CAPTURED_REAPPLY,
      description: `Re-applied ${points} points after captured payment for order ${order.orderNumber}`,
      session,
    });

    if (!ledger.inserted) return { changed: false, reason: 'already_reapplied' };

    const updateResult = await User.updateOne(
      { _id: order.user, loyaltyPoints: { $gte: points } },
      { $inc: { loyaltyPoints: -points } },
      { session }
    );

    if (updateResult.modifiedCount !== 1) {
      throw ApiError.badRequest('Payment was captured but restored loyalty points are no longer available. Please contact support.');
    }

    return { changed: true };
  }

  async earnForDeliveredOrder(order, { session } = {}) {
    if (!order?.user || !order?._id) return { changed: false, reason: 'guest_order' };
    if (!session) throw new Error('earnForDeliveredOrder requires a mongoose session');

    const totalInRupees = Math.max(0, Number(order.total || 0)) / 100;
    const pointsEarned = Math.floor(totalInRupees * env.loyalty.pointsPerRupee);
    if (pointsEarned <= 0) return { changed: false, reason: 'no_points' };

    const legacyAward = await LoyaltyPoints.findOne({
      user: order.user,
      referenceId: order._id,
      type: LOYALTY_TYPES.EARNED,
      source: 'order',
    }).session(session).lean();
    if (legacyAward) return { changed: false, reason: 'already_earned' };

    const ledger = await this.createLedgerOnce({
      userId: order.user,
      type: LOYALTY_TYPES.EARNED,
      points: pointsEarned,
      source: 'order',
      referenceId: order._id,
      eventType: EVENTS.ORDER_DELIVERED_EARN,
      description: `Points earned for order ${order.orderNumber}`,
      session,
    });

    if (!ledger.inserted) return { changed: false, reason: 'already_earned' };

    const earnResult = await User.updateOne(
      { _id: order.user },
      { $inc: { loyaltyPoints: pointsEarned } },
      { session }
    );
    if (earnResult.modifiedCount !== 1) {
      throw ApiError.notFound('Customer not found for loyalty award');
    }

    return { changed: true, pointsEarned };
  }

  async adjustBalance({ userId, points, source = 'admin', referenceId = null, description = '', session }) {
    const rawAdjustment = Number(points);
    if (!Number.isFinite(rawAdjustment) || !Number.isInteger(rawAdjustment) || rawAdjustment === 0) {
      throw ApiError.badRequest('Point adjustment must be a non-zero integer');
    }
    const adjustment = rawAdjustment;
    if (!session) throw new Error('adjustBalance requires a mongoose session');

    const filter = { _id: userId };
    if (adjustment < 0) {
      filter.loyaltyPoints = { $gte: Math.abs(adjustment) };
    }

    const updateResult = await User.updateOne(
      filter,
      { $inc: { loyaltyPoints: adjustment } },
      { session }
    );

    if (updateResult.modifiedCount !== 1) {
      const userExists = await User.exists({ _id: userId }).session(session);
      if (!userExists) throw ApiError.notFound('Customer not found');
      throw ApiError.badRequest('Cannot deduct more points than the customer currently has.');
    }

    await LoyaltyPoints.create([{
      user: userId,
      type: LOYALTY_TYPES.ADJUSTED,
      points: adjustment,
      source,
      referenceId,
      description,
    }], { session });

    const updatedUser = await User.findById(userId).select('loyaltyPoints').session(session);
    return { loyaltyPoints: updatedUser?.loyaltyPoints || 0 };
  }
}

module.exports = new LoyaltyService();
module.exports.LoyaltyService = LoyaltyService;
module.exports.EVENTS = EVENTS;
