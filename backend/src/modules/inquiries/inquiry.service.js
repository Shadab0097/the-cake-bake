'use strict';

const CustomCakeInquiry = require('../../models/CustomCakeInquiry');
const CorporateInquiry = require('../../models/CorporateInquiry');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const logger = require('../../middleware/logger');

class InquiryService {
  // Route an inquiry to a branch by its delivery city, falling back to the
  // configured default branch (mirrors order/quote branch resolution).
  async _resolveBranchId(city) {
    const { resolveBranchIdForCity } = require('../delivery/serviceability');
    const { getCommerceConfig } = require('../../utils/commerceSettings');
    const [byCity, config] = await Promise.all([
      resolveBranchIdForCity(city),
      getCommerceConfig(),
    ]);
    return byCity || config.defaultBranchId || null;
  }

  // ---- Custom Cake ----
  async submitCustomCakeInquiry(data, userId = null) {
    if (userId) data.user = userId;
    data.branchId = await this._resolveBranchId(data.city);
    const inquiry = await CustomCakeInquiry.create(data);

    // Notify admin — fire-and-forget
    setImmediate(async () => {
      try {
        const notificationService = require('../notifications/notification.service');
        await notificationService.sendInquiryAlert(inquiry, 'custom_cake');
      } catch (err) {
        logger.warn('[Inquiry] Admin alert (custom cake) failed:', err.message);
      }
    });

    return inquiry;
  }

  async getMyInquiries(userId) {
    const [custom, corporate] = await Promise.all([
      CustomCakeInquiry.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      CorporateInquiry.find({ email: { $exists: true } }).sort({ createdAt: -1 }).lean(),
    ]);
    return { customCake: custom, corporate };
  }

  // ---- Corporate ----
  async submitCorporateInquiry(data) {
    data.branchId = await this._resolveBranchId(data.city);
    const inquiry = await CorporateInquiry.create(data);

    // Notify admin — fire-and-forget
    setImmediate(async () => {
      try {
        const notificationService = require('../notifications/notification.service');
        await notificationService.sendInquiryAlert(inquiry, 'corporate');
      } catch (err) {
        logger.warn('[Inquiry] Admin alert (corporate) failed:', err.message);
      }
    });

    return inquiry;
  }

  // ---- Admin ----
  // `scope` is null for an owner or a string[] of branchIds for a walled admin.
  // Walled admins see only inquiries routed to their branches; legacy inquiries
  // (no branchId) stay owner-only until a backfill.
  async adminListCustomInquiries(query, scope = null) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (scope) filter.branchId = { $in: scope };

    const [items, total] = await Promise.all([
      CustomCakeInquiry.find(filter).populate('branchId', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CustomCakeInquiry.countDocuments(filter),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async adminListCorporateInquiries(query, scope = null) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (scope) filter.branchId = { $in: scope };

    const [items, total] = await Promise.all([
      CorporateInquiry.find(filter).populate('branchId', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CorporateInquiry.countDocuments(filter),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async adminUpdateInquiry(id, data, scope = null) {
    // A walled admin may only touch inquiries within their branches.
    const filter = scope ? { _id: id, branchId: { $in: scope } } : { _id: id };
    // Try custom first, then corporate
    let inquiry = await CustomCakeInquiry.findOneAndUpdate(filter, data, { new: true });
    if (!inquiry) {
      inquiry = await CorporateInquiry.findOneAndUpdate(filter, data, { new: true });
    }
    if (!inquiry) throw ApiError.notFound('Inquiry not found', [], 'INQUIRY_NOT_FOUND');
    return inquiry;
  }
}

module.exports = new InquiryService();
