const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');

class CouponService {
  async validateCoupon(userId, code, cartSubtotal) {
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) throw ApiError.badRequest('Invalid or expired coupon');

    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      throw ApiError.badRequest('Coupon usage limit reached');
    }

    const userUsage = await CouponUsage.countDocuments({ coupon: coupon._id, user: userId });
    if (userUsage >= coupon.perUserLimit) {
      throw ApiError.badRequest('You have already used this coupon');
    }

    if (cartSubtotal < coupon.minOrderAmount) {
      throw ApiError.badRequest(`Minimum order of ₹${coupon.minOrderAmount / 100} required`);
    }

    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = Math.round((cartSubtotal * coupon.value) / 100);
      if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else {
      discount = coupon.value;
    }

    return {
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description,
      },
      discount,
    };
  }

  // Admin CRUD
  async createCoupon(data) {
    data.code = data.code.toUpperCase();
    const existing = await Coupon.findOne({ code: data.code });
    if (existing) throw ApiError.conflict('Coupon code already exists');
    return Coupon.create(data);
  }

  async updateCoupon(id, data) {
    if (data.code) data.code = data.code.toUpperCase();
    const coupon = await Coupon.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!coupon) throw ApiError.notFound('Coupon not found');
    return coupon;
  }

  async deleteCoupon(id) {
    const coupon = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!coupon) throw ApiError.notFound('Coupon not found');
    return coupon;
  }

  async listCoupons(query = {}) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(filter),
    ]);

    return paginatedResponse(coupons, total, page, limit);
  }
}

module.exports = new CouponService();
