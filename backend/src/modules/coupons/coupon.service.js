const Coupon = require('../../models/Coupon');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const couponUsageService = require('./couponUsage.service');

class CouponService {
  async validateCoupon(userId, code, cartSubtotal) {
    const result = await couponUsageService.validateForCheckout({
      couponCode: code,
      userId,
      subtotal: cartSubtotal,
    });

    return {
      valid: true,
      coupon: {
        code: result.coupon.code,
        type: result.coupon.type,
        value: result.coupon.value,
        description: result.coupon.description,
      },
      discount: result.discount,
    };
  }

  // Admin CRUD
  async createCoupon(data) {
    data.code = data.code.toUpperCase();
    const existing = await Coupon.findOne({ code: data.code });
    if (existing) throw ApiError.conflict('Coupon code already exists', [{ field: 'code', code: 'COUPON_CODE_EXISTS', message: 'Coupon code already exists' }], 'COUPON_CODE_EXISTS');
    return Coupon.create(data);
  }

  async updateCoupon(id, data) {
    if (data.code) data.code = data.code.toUpperCase();
    const coupon = await Coupon.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!coupon) throw ApiError.notFound('Coupon not found', [], 'COUPON_NOT_FOUND');
    return coupon;
  }

  async deleteCoupon(id) {
    const coupon = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!coupon) throw ApiError.notFound('Coupon not found', [], 'COUPON_NOT_FOUND');
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
