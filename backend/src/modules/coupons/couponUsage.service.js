const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
const CouponUsageCounter = require('../../models/CouponUsageCounter');
const ApiError = require('../../utils/ApiError');

class CouponUsageService {
  normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  calculateDiscount(coupon, subtotal) {
    if (!coupon || subtotal < (coupon.minOrderAmount || 0)) return 0;

    if (coupon.type === 'percentage') {
      let discount = Math.round((subtotal * coupon.value) / 100);
      if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      return discount;
    }

    return coupon.value;
  }

  getIdentities({ userId, guestInfo } = {}) {
    if (userId) {
      return [{ identityType: 'user', identityKey: String(userId), user: userId }];
    }

    const identities = [];
    const guestEmail = this.normalizeEmail(guestInfo?.email);
    const guestPhone = this.normalizePhone(guestInfo?.phone);

    if (guestEmail) {
      identities.push({ identityType: 'guest_email', identityKey: guestEmail, guestEmail });
    }

    if (guestPhone) {
      identities.push({ identityType: 'guest_phone', identityKey: guestPhone, guestPhone });
    }

    return identities;
  }

  usageFilterForIdentity(couponId, identity) {
    if (identity.identityType === 'user') {
      return { coupon: couponId, user: identity.user };
    }

    if (identity.identityType === 'guest_email') {
      return { coupon: couponId, guestEmail: identity.guestEmail };
    }

    return { coupon: couponId, guestPhone: identity.guestPhone };
  }

  counterFilter(couponId, identity) {
    return {
      coupon: couponId,
      identityType: identity.identityType,
      identityKey: identity.identityKey,
    };
  }

  counterInsertFields(identity) {
    return {
      user: identity.user || null,
      guestEmail: identity.guestEmail || '',
      guestPhone: identity.guestPhone || '',
    };
  }

  async findValidCoupon(couponCode, subtotal, session = null) {
    const now = new Date();
    const query = Coupon.findOne({
      code: this.normalizeCode(couponCode),
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      minOrderAmount: { $lte: subtotal },
    });

    return session ? query.session(session) : query;
  }

  async getIdentityUsageCount(couponId, identity, session = null) {
    const counterQuery = CouponUsageCounter.findOne(this.counterFilter(couponId, identity)).select('count');
    const usageQuery = CouponUsage.countDocuments(this.usageFilterForIdentity(couponId, identity));

    const counter = session ? await counterQuery.session(session) : await counterQuery;
    const usageCount = session ? await usageQuery.session(session) : await usageQuery;

    return Math.max(counter?.count || 0, usageCount || 0);
  }

  async validateForCheckout({ couponCode, userId, guestInfo, subtotal, session = null }) {
    const coupon = await this.findValidCoupon(couponCode, subtotal, session);
    if (!coupon) throw ApiError.badRequest('Coupon is no longer valid for this order', [{ field: 'couponCode', code: 'COUPON_INVALID', message: 'Coupon is no longer valid for this order' }], 'COUPON_INVALID');

    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      throw ApiError.badRequest('Coupon usage limit reached', [{ field: 'couponCode', code: 'COUPON_USAGE_LIMIT_REACHED', message: 'Coupon usage limit reached' }], 'COUPON_USAGE_LIMIT_REACHED');
    }

    if (coupon.perUserLimit > 0) {
      const identities = this.getIdentities({ userId, guestInfo });
      if (identities.length === 0) {
        throw ApiError.badRequest('Coupon cannot be applied without customer details', [], 'COUPON_CUSTOMER_DETAILS_REQUIRED');
      }

      for (const identity of identities) {
        const usageCount = await this.getIdentityUsageCount(coupon._id, identity, session);
        if (usageCount >= coupon.perUserLimit) {
          throw ApiError.badRequest('You have already used this coupon', [{ field: 'couponCode', code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon' }], 'COUPON_ALREADY_USED');
        }
      }
    }

    return {
      coupon,
      discount: this.calculateDiscount(coupon, subtotal),
    };
  }

  async bootstrapCounter(couponId, identity, orderId, session) {
    const usageCount = await CouponUsage.countDocuments({
      ...this.usageFilterForIdentity(couponId, identity),
      order: { $ne: orderId },
    }).session(session);
    if (usageCount <= 0) return;

    try {
      await CouponUsageCounter.updateOne(
        this.counterFilter(couponId, identity),
        {
          $setOnInsert: {
            ...this.counterFilter(couponId, identity),
            ...this.counterInsertFields(identity),
          },
          $max: { count: usageCount },
        },
        { session, upsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  async incrementIdentityCounter(couponId, identity, perUserLimit, orderId, session) {
    if (!perUserLimit || perUserLimit <= 0) return;

    await this.bootstrapCounter(couponId, identity, orderId, session);

    const filter = {
      ...this.counterFilter(couponId, identity),
      count: { $lt: perUserLimit },
    };
    const update = {
      $setOnInsert: {
        ...this.counterFilter(couponId, identity),
        ...this.counterInsertFields(identity),
      },
      $set: { lastOrder: orderId },
      $inc: { count: 1 },
    };

    try {
      const counter = await CouponUsageCounter.findOneAndUpdate(filter, update, {
        session,
        new: true,
        upsert: true,
      });
      if (!counter) throw ApiError.badRequest('You have already used this coupon', [{ field: 'couponCode', code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon' }], 'COUPON_ALREADY_USED');
    } catch (error) {
      if (error.code !== 11000) throw error;

      const counter = await CouponUsageCounter.findOneAndUpdate(filter, update, {
        session,
        new: true,
      });
      if (!counter) throw ApiError.badRequest('You have already used this coupon', [{ field: 'couponCode', code: 'COUPON_ALREADY_USED', message: 'You have already used this coupon' }], 'COUPON_ALREADY_USED');
    }
  }

  async decrementIdentityCounter(couponId, identity, session) {
    await CouponUsageCounter.updateOne(
      {
        ...this.counterFilter(couponId, identity),
        count: { $gt: 0 },
      },
      { $inc: { count: -1 } },
      { session }
    );
  }

  async resolveCoupon({ coupon, couponCode, session }) {
    if (coupon) return coupon;
    const query = Coupon.findOne({ code: this.normalizeCode(couponCode) });
    return session ? query.session(session) : query;
  }

  async consumeForOrder({ coupon, couponCode, userId, guestInfo, orderId, session }) {
    const resolvedCoupon = await this.resolveCoupon({ coupon, couponCode, session });
    if (!resolvedCoupon) return { consumed: false, reason: 'coupon_not_found' };

    const existingUsage = await CouponUsage.findOne({ coupon: resolvedCoupon._id, order: orderId }).session(session);
    if (existingUsage) return { consumed: false, reason: 'already_consumed' };

    const identities = this.getIdentities({ userId, guestInfo });
    if (resolvedCoupon.perUserLimit > 0 && identities.length === 0) {
      throw ApiError.badRequest('Coupon cannot be applied without customer details', [], 'COUPON_CUSTOMER_DETAILS_REQUIRED');
    }

    try {
      const usageResult = await CouponUsage.updateOne(
        { coupon: resolvedCoupon._id, order: orderId },
        {
          $setOnInsert: {
            coupon: resolvedCoupon._id,
            user: userId || null,
            guestEmail: this.normalizeEmail(guestInfo?.email),
            guestPhone: this.normalizePhone(guestInfo?.phone),
            order: orderId,
          },
        },
        { session, upsert: true }
      );

      if (usageResult.upsertedCount === 0) {
        return { consumed: false, reason: 'already_consumed' };
      }
    } catch (error) {
      if (error.code === 11000) {
        return { consumed: false, reason: 'already_consumed' };
      }
      throw error;
    }

    const couponFilter = { _id: resolvedCoupon._id };
    if (resolvedCoupon.usageLimit > 0) {
      couponFilter.usageCount = { $lt: resolvedCoupon.usageLimit };
    }

    const couponUpdate = await Coupon.updateOne(
      couponFilter,
      { $inc: { usageCount: 1 } },
      { session }
    );

    if (couponUpdate.modifiedCount !== 1) {
      throw ApiError.badRequest('Coupon usage limit reached', [{ field: 'couponCode', code: 'COUPON_USAGE_LIMIT_REACHED', message: 'Coupon usage limit reached' }], 'COUPON_USAGE_LIMIT_REACHED');
    }

    for (const identity of identities) {
      await this.incrementIdentityCounter(resolvedCoupon._id, identity, resolvedCoupon.perUserLimit, orderId, session);
    }

    return { consumed: true };
  }

  identitiesFromUsage(usage) {
    if (usage.user) {
      return [{ identityType: 'user', identityKey: String(usage.user), user: usage.user }];
    }

    const identities = [];
    const guestEmail = this.normalizeEmail(usage.guestEmail);
    const guestPhone = this.normalizePhone(usage.guestPhone);

    if (guestEmail) {
      identities.push({ identityType: 'guest_email', identityKey: guestEmail, guestEmail });
    }

    if (guestPhone) {
      identities.push({ identityType: 'guest_phone', identityKey: guestPhone, guestPhone });
    }

    return identities;
  }

  async releaseForOrder(order, session) {
    if (!order?.couponCode) return { released: false, reason: 'no_coupon' };

    const coupon = await Coupon.findOne({ code: this.normalizeCode(order.couponCode) }).session(session);
    if (!coupon) return { released: false, reason: 'coupon_not_found' };

    const usage = await CouponUsage.findOne({ coupon: coupon._id, order: order._id }).session(session);
    if (!usage) return { released: false, reason: 'usage_not_found' };

    const deleteResult = await CouponUsage.deleteOne({ _id: usage._id }).session(session);
    if (deleteResult.deletedCount !== 1) return { released: false, reason: 'already_released' };

    await Coupon.updateOne(
      { _id: coupon._id, usageCount: { $gt: 0 } },
      { $inc: { usageCount: -1 } },
      { session }
    );

    for (const identity of this.identitiesFromUsage(usage)) {
      await this.decrementIdentityCounter(coupon._id, identity, session);
    }

    return { released: true };
  }
}

module.exports = new CouponUsageService();
module.exports.CouponUsageService = CouponUsageService;
