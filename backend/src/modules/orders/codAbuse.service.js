const crypto = require('crypto');

const Order = require('../../models/Order');
const User = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const { ORDER_STATUSES } = require('../../utils/constants');
const operationalAlertService = require('../monitoring/operationalAlert.service');

const REPEATED_DIGIT_PATTERN = /^(\d)\1{9,}$/;
const SEQUENTIAL_PHONE_PATTERNS = new Set(['0123456789', '1234567890', '9876543210']);

const normalizePhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeAddressPart = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildAddressHash = (address = {}) => {
  const normalized = [
    normalizeAddressPart(address.addressLine1),
    normalizeAddressPart(address.addressLine2),
    normalizeAddressPart(address.city),
    normalizeAddressPart(address.state),
    normalizeAddressPart(address.pincode),
  ].join('|');

  if (normalized.replace(/\|/g, '').length === 0) return '';
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const getEmailDomain = (email) => {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf('@');
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : '';
};

const isSuspiciousPhone = (normalizedPhone) => {
  if (!normalizedPhone || normalizedPhone.length < 10) return true;
  if (REPEATED_DIGIT_PATTERN.test(normalizedPhone)) return true;
  return SEQUENTIAL_PHONE_PATTERNS.has(normalizedPhone.slice(-10));
};

const unique = (values) => [...new Set(values.filter(Boolean))];

class CodAbuseService {
  constructor(deps = {}) {
    this.OrderModel = deps.OrderModel || Order;
    this.UserModel = deps.UserModel || User;
    this.operationalAlertService = deps.operationalAlertService || operationalAlertService;
    this.config = deps.config || env.codAbuse;
  }

  buildRequestContext(req = {}) {
    const forwardedFor = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    return {
      ip: forwardedFor || req.ip || req.socket?.remoteAddress || '',
      userAgent: String(req.headers?.['user-agent'] || '').slice(0, 500),
      requestId: String(req.id || req.requestId || req.headers?.['x-request-id'] || '').slice(0, 120),
    };
  }

  buildRiskSnapshot(assessment) {
    return {
      normalizedPhone: assessment.normalizedPhone,
      normalizedEmail: assessment.normalizedEmail,
      addressHash: assessment.addressHash,
      score: assessment.score,
      decision: assessment.decision,
      flags: assessment.flags,
      evaluatedAt: assessment.evaluatedAt,
    };
  }

  createAllowedAssessment({ normalizedPhone = '', normalizedEmail = '', addressHash = '', requestContext = {} } = {}) {
    return {
      allowed: true,
      decision: 'allow',
      flags: [],
      score: 0,
      message: '',
      normalizedPhone,
      normalizedEmail,
      addressHash,
      checkoutIp: requestContext.ip || '',
      checkoutUserAgent: requestContext.userAgent || '',
      evaluatedAt: new Date(),
    };
  }

  async countOrders(filter, session = null) {
    const query = this.OrderModel.countDocuments(filter);
    return session && query.session ? query.session(session) : query;
  }

  async getUser(userId, session = null) {
    if (!userId) return null;
    const query = this.UserModel.findById(userId).select('email phone codDisabled codDisabledReason');
    return session && query.session ? query.session(session).lean() : query.lean();
  }

  buildPhoneFilter(normalizedPhone, rawPhones = []) {
    const candidates = unique([
      ...rawPhones,
      normalizedPhone,
      normalizedPhone ? `+91${normalizedPhone}` : '',
    ]);

    return {
      $or: [
        { 'codRisk.normalizedPhone': normalizedPhone },
        { 'shippingAddress.phone': { $in: candidates } },
        { 'guestInfo.phone': { $in: candidates } },
      ],
    };
  }

  async buildAssessment(input = {}) {
    const {
      userId = null,
      guestInfo = {},
      shippingAddress = {},
      total = 0,
      isGuest = false,
      requestContext = {},
      session = null,
    } = input;

    const rawPhones = unique([shippingAddress.phone, guestInfo.phone]);
    const normalizedPhone = normalizePhone(shippingAddress.phone || guestInfo.phone);
    const addressHash = buildAddressHash(shippingAddress);
    const user = await this.getUser(userId, session);
    const normalizedEmail = normalizeEmail(guestInfo.email || user?.email || '');
    const assessment = this.createAllowedAssessment({
      normalizedPhone,
      normalizedEmail,
      addressHash,
      requestContext,
    });

    // ── Merchant COD policy (global kill-switch + per-zone) ──────────────────
    // Enforced BEFORE the abuse engine and regardless of whether it's enabled.
    // Flags are left empty so this normal merchant choice doesn't raise
    // operational alerts; the rejection still carries a clear reason.
    if (input.globalCodEnabled === false || input.zoneCodEnabled === false) {
      const code = input.globalCodEnabled === false ? 'cod_globally_disabled' : 'cod_zone_disabled';
      const detail = this.buildBlockDetail([code]);
      assessment.flags = [];
      assessment.score = 100;
      assessment.decision = 'online_required';
      assessment.allowed = false;
      assessment.message = detail.message;
      assessment.reasonCode = detail.code;
      assessment.reasonField = detail.field;
      return assessment;
    }

    if (!this.config.enabled) return assessment;

    const flags = [];
    const blocks = [];
    let score = 0;
    const now = Date.now();

    if (user?.codDisabled) {
      blocks.push('cod_disabled_user');
      score += 100;
    }

    if (total > this.config.maxOrderAmount) {
      blocks.push('cod_amount_too_high');
      score += 50;
    } else if (total >= this.config.reviewOrderAmount) {
      flags.push('high_value_cod');
      score += 15;
    }

    if (isSuspiciousPhone(normalizedPhone)) {
      blocks.push('suspicious_phone');
      score += 40;
    }

    const emailDomain = getEmailDomain(normalizedEmail);
    if (emailDomain && this.config.disposableEmailDomains.includes(emailDomain)) {
      blocks.push('disposable_email');
      score += 35;
    }

    if (guestInfo.phone && shippingAddress.phone && normalizePhone(guestInfo.phone) !== normalizePhone(shippingAddress.phone)) {
      flags.push('guest_shipping_phone_mismatch');
      score += 10;
    }

    if (normalizedPhone) {
      const since = new Date(now - this.config.phoneOrderWindowHours * 60 * 60 * 1000);
      const phoneCount = await this.countOrders({
        paymentMethod: 'cod',
        createdAt: { $gte: since },
        ...this.buildPhoneFilter(normalizedPhone, rawPhones),
      }, session);

      if (phoneCount >= this.config.phoneOrderLimit) {
        blocks.push('phone_velocity_exceeded');
        score += 50;
      } else if (phoneCount >= Math.max(1, this.config.phoneOrderLimit - 1)) {
        flags.push('phone_velocity_near_limit');
        score += 10;
      }
    }

    if (isGuest && requestContext.ip) {
      const since = new Date(now - this.config.guestIpOrderWindowHours * 60 * 60 * 1000);
      const ipCount = await this.countOrders({
        paymentMethod: 'cod',
        user: null,
        checkoutIp: requestContext.ip,
        createdAt: { $gte: since },
      }, session);

      if (ipCount >= this.config.guestIpOrderLimit) {
        blocks.push('guest_ip_velocity_exceeded');
        score += 45;
      }
    }

    if (addressHash) {
      const since = new Date(now - this.config.addressCancelWindowDays * 24 * 60 * 60 * 1000);
      const cancellationCount = await this.countOrders({
        paymentMethod: 'cod',
        status: ORDER_STATUSES.CANCELLED,
        createdAt: { $gte: since },
        'codRisk.addressHash': addressHash,
      }, session);

      if (cancellationCount >= this.config.addressCancelLimit) {
        blocks.push('address_cancellation_velocity_exceeded');
        score += 50;
      }
    }

    assessment.flags = unique([...flags, ...blocks]);
    assessment.score = score;
    assessment.decision = blocks.length > 0 ? 'online_required' : (flags.length > 0 ? 'review' : 'allow');
    assessment.allowed = blocks.length === 0;
    const detail = this.buildBlockDetail(blocks);
    assessment.message = blocks.length > 0 ? detail.message : '';
    assessment.reasonCode = blocks.length > 0 ? detail.code : '';
    assessment.reasonField = blocks.length > 0 ? detail.field : '';
    return assessment;
  }

  // Maps each block reason to a specific, user-actionable detail.
  // The message tells the customer the real reason and how to fix it, while
  // `field`/`code` let the frontend highlight the offending input. Velocity and
  // fraud-pattern reasons stay actionable without leaking exact thresholds.
  buildBlockDetail(blocks = []) {
    const cfg = this.config || {};

    if (blocks.includes('cod_globally_disabled')) {
      return {
        code: 'cod_globally_disabled',
        field: 'paymentMethod',
        message: 'Cash on Delivery is currently unavailable. Please choose online payment to place your order.',
      };
    }

    if (blocks.includes('cod_zone_disabled')) {
      return {
        code: 'cod_zone_disabled',
        field: 'paymentMethod',
        message: 'Cash on Delivery isn’t available for your delivery area. Please choose online payment.',
      };
    }

    if (blocks.includes('cod_disabled_user')) {
      return {
        code: 'cod_disabled_user',
        field: 'paymentMethod',
        message: 'Cash on Delivery is unavailable for this account because COD has been disabled on it. Please choose online payment.',
      };
    }

    if (blocks.includes('cod_amount_too_high')) {
      const limit = Number(cfg.maxOrderAmount) || 0;
      const limitText = limit
        ? ` Cash on Delivery is only available for orders up to ₹${limit.toLocaleString('en-IN')}.`
        : '';
      return {
        code: 'cod_amount_too_high',
        field: 'paymentMethod',
        message: `Cash on Delivery is unavailable for this order amount.${limitText} Please choose online payment for higher-value orders.`,
      };
    }

    if (blocks.includes('phone_velocity_exceeded')) {
      return {
        code: 'phone_velocity_exceeded',
        field: 'phone',
        message: 'Cash on Delivery is temporarily unavailable because too many COD orders were recently placed from this phone number. Please try again later or choose online payment.',
      };
    }

    if (blocks.includes('guest_ip_velocity_exceeded')) {
      return {
        code: 'guest_ip_velocity_exceeded',
        field: 'paymentMethod',
        message: 'Cash on Delivery is temporarily unavailable because too many guest COD orders were recently placed from this network. Please try again later or choose online payment.',
      };
    }

    if (blocks.includes('address_cancellation_velocity_exceeded')) {
      return {
        code: 'address_cancellation_velocity_exceeded',
        field: 'shippingAddress',
        message: 'Cash on Delivery is unavailable for this delivery address because of repeated COD cancellations at this address. Please choose online payment.',
      };
    }

    if (blocks.includes('suspicious_phone')) {
      return {
        code: 'invalid_phone',
        field: 'phone',
        message: 'The phone number entered does not appear to be a valid mobile number. Please provide a genuine 10-digit phone number to use Cash on Delivery, or choose online payment.',
      };
    }

    if (blocks.includes('disposable_email')) {
      return {
        code: 'disposable_email',
        field: 'email',
        message: 'Cash on Delivery is not available for temporary or disposable email addresses. Please use a permanent email address, or choose online payment.',
      };
    }

    return {
      code: 'cod_unavailable',
      field: 'paymentMethod',
      message: 'Cash on Delivery is unavailable for this checkout. Please choose online payment.',
    };
  }

  messageForBlocks(blocks) {
    return this.buildBlockDetail(blocks).message;
  }

  async recordAssessment(assessment, input = {}) {
    if (!assessment.flags.length) return;

    const severity = assessment.allowed ? 'warning' : 'critical';
    await this.operationalAlertService.recordAlert({
      type: 'suspicious_cod_checkout',
      severity,
      source: 'checkout.cod',
      message: assessment.allowed
        ? 'COD checkout passed with risk flags'
        : 'COD checkout blocked by abuse controls',
      dedupeKey: `cod_abuse:${assessment.decision}:${assessment.normalizedPhone || assessment.checkoutIp || 'unknown'}:${assessment.flags[0] || 'flag'}`,
      metadata: {
        userId: input.userId || null,
        isGuest: Boolean(input.isGuest),
        total: input.total || 0,
        flags: assessment.flags,
        score: assessment.score,
        normalizedPhone: assessment.normalizedPhone,
        normalizedEmail: assessment.normalizedEmail,
        checkoutIp: assessment.checkoutIp,
        requestId: input.requestContext?.requestId || '',
      },
    }).catch(() => {});
  }

  async assertCanUseCOD(input = {}) {
    const assessment = await this.buildAssessment(input);
    await this.recordAssessment(assessment, input);

    if (!assessment.allowed) {
      const errors = [{
        field: assessment.reasonField || 'paymentMethod',
        code: assessment.reasonCode || 'cod_unavailable',
        message: assessment.message,
      }];
      const isVelocityBlock = assessment.flags.includes('phone_velocity_exceeded') ||
        assessment.flags.includes('guest_ip_velocity_exceeded');
      throw (isVelocityBlock
        ? ApiError.tooMany(assessment.message, errors)
        : ApiError.badRequest(assessment.message, errors));
    }

    return assessment;
  }
}

const service = new CodAbuseService();

module.exports = service;
module.exports.CodAbuseService = CodAbuseService;
module.exports.buildAddressHash = buildAddressHash;
module.exports.normalizeEmail = normalizeEmail;
module.exports.normalizePhone = normalizePhone;
module.exports.isSuspiciousPhone = isSuspiciousPhone;
