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

  // Admin CRUD. `scope` is null for an owner (chain-wide authority) or a
  // string[] of branchIds for a walled admin, who may only manage coupons owned
  // by one of their branches (chain-wide coupons stay owner-only).
  async createCoupon(data, scope = null) {
    data.code = data.code.toUpperCase();
    if (scope) {
      // Walled creator: force the coupon onto one of their own branches.
      const requested = data.branchId ? String(data.branchId) : (scope.length === 1 ? scope[0] : null);
      if (!requested || !scope.includes(requested)) {
        throw ApiError.badRequest('Select one of your branches for this coupon', [{ field: 'branchId', code: 'COUPON_BRANCH_REQUIRED', message: 'Select one of your branches for this coupon' }], 'COUPON_BRANCH_REQUIRED');
      }
      data.branchId = requested;
    } else if (data.branchId === '' || data.branchId === undefined) {
      data.branchId = null; // owner: empty => chain-wide
    }
    const existing = await Coupon.findOne({ code: data.code });
    if (existing) throw ApiError.conflict('Coupon code already exists', [{ field: 'code', code: 'COUPON_CODE_EXISTS', message: 'Coupon code already exists' }], 'COUPON_CODE_EXISTS');
    return Coupon.create(data);
  }

  async updateCoupon(id, data, scope = null) {
    if (data.code) data.code = data.code.toUpperCase();
    const filter = { _id: id };
    if (scope) {
      filter.branchId = { $in: scope }; // walled: can only touch own-branch coupons
      // ...and may not reassign a coupon to another branch or to chain-wide.
      if (data.branchId !== undefined) {
        const target = data.branchId ? String(data.branchId) : null;
        if (!target || !scope.includes(target)) {
          throw ApiError.badRequest('You can only assign coupons to your own branch', [{ field: 'branchId', code: 'COUPON_BRANCH_FORBIDDEN', message: 'You can only assign coupons to your own branch' }], 'COUPON_BRANCH_FORBIDDEN');
        }
      }
    } else if (data.branchId === '') {
      data.branchId = null; // owner: empty => chain-wide
    }
    const coupon = await Coupon.findOneAndUpdate(filter, data, { new: true, runValidators: true });
    if (!coupon) throw ApiError.notFound('Coupon not found', [], 'COUPON_NOT_FOUND');
    return coupon;
  }

  async deleteCoupon(id, scope = null) {
    const filter = { _id: id };
    if (scope) filter.branchId = { $in: scope };
    const coupon = await Coupon.findOneAndUpdate(filter, { isActive: false }, { new: true });
    if (!coupon) throw ApiError.notFound('Coupon not found', [], 'COUPON_NOT_FOUND');
    return coupon;
  }

  async listCoupons(query = {}, scope = null) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (scope) filter.branchId = { $in: scope }; // walled: only own-branch coupons

    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .populate('branchId', 'name code')
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
