const crypto = require('crypto');
const Order = require('../../models/Order');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');

const TOKEN_VERSION = 1;
const TOKEN_SEPARATOR = '.';

class GuestTrackingService {
  base64UrlEncode(value) {
    return Buffer.from(value).toString('base64url');
  }

  base64UrlJson(value) {
    return this.base64UrlEncode(JSON.stringify(value));
  }

  getSecret() {
    const secret = env.jwt.secret || process.env.JWT_SECRET;
    if (!secret) throw ApiError.internal('Guest order tracking is not configured');
    return secret;
  }

  signPayload(payload) {
    return crypto
      .createHmac('sha256', this.getSecret())
      .update(payload)
      .digest('base64url');
  }

  hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(String(token || ''))
      .digest('hex');
  }

  timingSafeEqual(actual, expected) {
    if (!actual || !expected) return false;

    const actualBuffer = Buffer.from(String(actual));
    const expectedBuffer = Buffer.from(String(expected));
    if (actualBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  generateToken(order) {
    if (!order?._id || !order?.orderNumber) {
      throw new Error('generateToken requires an order with _id and orderNumber');
    }

    const payload = this.base64UrlJson({
      v: TOKEN_VERSION,
      oid: String(order._id),
      on: String(order.orderNumber),
      nonce: crypto.randomBytes(24).toString('base64url'),
      iat: Math.floor(Date.now() / 1000),
    });
    const signature = this.signPayload(payload);

    return `${payload}${TOKEN_SEPARATOR}${signature}`;
  }

  verifyToken(token, orderNumber) {
    const rawToken = String(token || '').trim();
    const [payload, signature, extra] = rawToken.split(TOKEN_SEPARATOR);
    if (!payload || !signature || extra !== undefined) {
      throw ApiError.forbidden('Invalid guest tracking token');
    }

    const expectedSignature = this.signPayload(payload);
    if (!this.timingSafeEqual(signature, expectedSignature)) {
      throw ApiError.forbidden('Invalid guest tracking token');
    }

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch (error) {
      throw ApiError.forbidden('Invalid guest tracking token');
    }

    if (
      decoded?.v !== TOKEN_VERSION ||
      !decoded?.oid ||
      !decoded?.on ||
      decoded.on !== String(orderNumber)
    ) {
      throw ApiError.forbidden('Invalid guest tracking token');
    }

    return decoded;
  }

  buildTrackingUrl(order, token) {
    return `/order-tracking/${encodeURIComponent(order.orderNumber)}?token=${encodeURIComponent(token)}`;
  }

  buildPublicOrder(order) {
    const source = typeof order.toObject === 'function'
      ? order.toObject({ depopulate: false, versionKey: false })
      : { ...order };

    return {
      _id: source._id,
      orderNumber: source.orderNumber,
      items: source.items || [],
      shippingAddress: source.shippingAddress || null,
      deliveryDate: source.deliveryDate,
      deliverySlot: source.deliverySlot || {},
      deliveryCity: source.deliveryCity || '',
      subtotal: source.subtotal,
      deliveryCharge: source.deliveryCharge,
      discount: source.discount,
      couponCode: source.couponCode,
      pointsRedeemed: source.pointsRedeemed,
      pointsDiscount: source.pointsDiscount,
      tax: source.tax,
      total: source.total,
      status: source.status,
      statusHistory: source.statusHistory || [],
      paymentStatus: source.paymentStatus,
      paymentMethod: source.paymentMethod,
      refundStatus: source.refundStatus || '',
      refundAmount: source.refundAmount || 0,
      cancellation: source.cancellation || {},
      specialInstructions: source.specialInstructions || '',
      isGift: Boolean(source.isGift),
      giftMessage: source.giftMessage || '',
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  async attachTokenToOrder(order, session) {
    if (!order || order.user) return { token: '', trackingUrl: '' };
    if (!session) throw new Error('attachTokenToOrder requires a mongoose session');

    const token = this.generateToken(order);
    const tokenHash = this.hashToken(token);

    await Order.updateOne(
      { _id: order._id, user: null },
      {
        $set: {
          guestTrackingTokenHash: tokenHash,
          guestTrackingTokenIssuedAt: new Date(),
        },
      },
      { session }
    );

    order.guestTrackingTokenHash = undefined;
    order.guestTrackingTokenIssuedAt = undefined;

    return {
      token,
      trackingUrl: this.buildTrackingUrl(order, token),
    };
  }

  async getGuestOrder(orderNumber, token) {
    const decoded = this.verifyToken(token, orderNumber);
    const tokenHash = this.hashToken(token);

    const order = await Order.findOne({
      _id: decoded.oid,
      orderNumber: decoded.on,
      user: null,
      guestTrackingTokenHash: tokenHash,
    })
      .select('+guestTrackingTokenHash')
      .lean();

    if (!order) throw ApiError.notFound('Order not found');

    return this.buildPublicOrder(order);
  }
}

module.exports = new GuestTrackingService();
