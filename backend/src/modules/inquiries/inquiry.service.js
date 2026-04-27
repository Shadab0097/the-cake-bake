'use strict';

const CustomCakeInquiry = require('../../models/CustomCakeInquiry');
const CorporateInquiry = require('../../models/CorporateInquiry');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const logger = require('../../middleware/logger');

class InquiryService {
  // ---- Custom Cake ----
  async submitCustomCakeInquiry(data, userId = null) {
    if (userId) data.user = userId;
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
  async adminListCustomInquiries(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      CustomCakeInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CustomCakeInquiry.countDocuments(filter),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async adminListCorporateInquiries(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};
    if (query.status) filter.status = query.status;

    const [items, total] = await Promise.all([
      CorporateInquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CorporateInquiry.countDocuments(filter),
    ]);
    return paginatedResponse(items, total, page, limit);
  }

  async adminUpdateInquiry(id, data) {
    // Try custom first, then corporate
    let inquiry = await CustomCakeInquiry.findByIdAndUpdate(id, data, { new: true });
    if (!inquiry) {
      inquiry = await CorporateInquiry.findByIdAndUpdate(id, data, { new: true });
    }
    if (!inquiry) throw ApiError.notFound('Inquiry not found');
    return inquiry;
  }
}

module.exports = new InquiryService();
