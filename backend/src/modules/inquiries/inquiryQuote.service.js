'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const InquiryQuote = require('../../models/InquiryQuote');
const CustomCakeInquiry = require('../../models/CustomCakeInquiry');
const CorporateInquiry = require('../../models/CorporateInquiry');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const DeliveryZone = require('../../models/DeliveryZone');
const ApiError = require('../../utils/ApiError');
const { env } = require('../../config/env');
const { getRazorpayInstance } = require('../../config/razorpay');
const { escapeRegex, generateOrderNumber } = require('../../utils/helpers');
const { INQUIRY_QUOTE_STATUSES, INQUIRY_STATUSES, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const cache = require('../../utils/cache');
const guestTrackingService = require('../orders/guestTracking.service');
const paymentService = require('../payments/payment.service');
const logger = require('../../middleware/logger');

const CAPTURE_READY_PAYMENT_STATUSES = [
  PAYMENT_STATUSES.CREATED,
  PAYMENT_STATUSES.PENDING,
  PAYMENT_STATUSES.AUTHORIZED,
  PAYMENT_STATUSES.FAILED,
  PAYMENT_STATUSES.EXPIRED,
];

const typeLabel = (inquiryType) => (inquiryType === 'corporate' ? 'Corporate' : 'Custom Cake');
const quoteTokenHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const toPaise = (amount) => Math.round(Number(amount) * 100);

const normalizeDeliverySlot = (deliverySlot) => {
  if (!deliverySlot) return {};
  if (typeof deliverySlot === 'string') {
    const parts = deliverySlot.split('-').map((part) => part.trim());
    return {
      label: deliverySlot,
      startTime: parts[0] || '',
      endTime: parts[1] || '',
    };
  }
  return {
    label: deliverySlot.label || '',
    startTime: deliverySlot.startTime || '',
    endTime: deliverySlot.endTime || '',
  };
};

const inquiryModels = {
  custom_cake: CustomCakeInquiry,
  corporate: CorporateInquiry,
};

class InquiryQuoteService {
  generateToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  buildApprovalUrl(token) {
    return `${env.app.url.replace(/\/$/, '')}/quote/${encodeURIComponent(token)}`;
  }

  getCustomerSnapshot(inquiry, inquiryType) {
    return {
      name: inquiryType === 'corporate'
        ? inquiry.contactName || inquiry.companyName || 'Customer'
        : inquiry.name || 'Customer',
      email: inquiry.email || '',
      phone: inquiry.phone || '',
    };
  }

  async findInquiryById(id) {
    const custom = await CustomCakeInquiry.findById(id);
    if (custom) return { inquiry: custom, inquiryType: 'custom_cake', Model: CustomCakeInquiry };

    const corporate = await CorporateInquiry.findById(id);
    if (corporate) return { inquiry: corporate, inquiryType: 'corporate', Model: CorporateInquiry };

    throw ApiError.notFound('Inquiry not found');
  }

  getPublicInquiryDetails(inquiry, inquiryType) {
    if (inquiryType === 'corporate') {
      return {
        type: inquiryType,
        label: typeLabel(inquiryType),
        companyName: inquiry.companyName || '',
        contactName: inquiry.contactName || '',
        email: inquiry.email || '',
        phone: inquiry.phone || '',
        eventType: inquiry.eventType || '',
        quantity: inquiry.quantity || 1,
        requirements: inquiry.requirements || '',
        deliveryDate: inquiry.deliveryDate || null,
        referenceImages: inquiry.referenceImages || [],
      };
    }

    return {
      type: inquiryType,
      label: typeLabel(inquiryType),
      name: inquiry.name || '',
      email: inquiry.email || '',
      phone: inquiry.phone || '',
      occasion: inquiry.occasion || '',
      flavor: inquiry.flavor || '',
      weight: inquiry.weight || '',
      message: inquiry.message || '',
      designDescription: inquiry.designDescription || '',
      deliveryDate: inquiry.deliveryDate || null,
      referenceImages: inquiry.referenceImages || [],
    };
  }

  getQuoteResponse(quote, inquiry, inquiryType, extra = {}) {
    const now = new Date();
    const expired = quote.expiresAt && quote.expiresAt <= now;
    const status = expired && quote.status === INQUIRY_QUOTE_STATUSES.SENT
      ? INQUIRY_QUOTE_STATUSES.EXPIRED
      : quote.status;

    return {
      _id: quote._id,
      inquiryType,
      inquiry: this.getPublicInquiryDetails(inquiry, inquiryType),
      status,
      amount: quote.amount,
      currency: quote.currency || 'INR',
      notes: quote.notes || '',
      sentAt: quote.sentAt,
      expiresAt: quote.expiresAt,
      acceptedAt: quote.acceptedAt,
      convertedAt: quote.convertedAt,
      orderNumber: extra.order?.orderNumber || null,
      paymentStatus: extra.order?.paymentStatus || '',
      canAccept: Boolean(
        (status === INQUIRY_QUOTE_STATUSES.SENT && !expired) ||
        (
          status === INQUIRY_QUOTE_STATUSES.ACCEPTED &&
          extra.order &&
          extra.order.status === ORDER_STATUSES.PENDING &&
          extra.order.paymentStatus !== 'paid'
        )
      ),
      ...extra,
    };
  }

  async markExpiredIfNeeded(quote, inquiryType) {
    if (!quote || quote.status !== INQUIRY_QUOTE_STATUSES.SENT || quote.expiresAt > new Date()) return quote;

    quote.status = INQUIRY_QUOTE_STATUSES.EXPIRED;
    await quote.save();

    const Model = inquiryModels[inquiryType];
    await Model.updateOne(
      { _id: quote.inquiry, latestQuote: quote._id },
      { $set: { quoteStatus: INQUIRY_QUOTE_STATUSES.EXPIRED } }
    );

    return quote;
  }

  async sendQuote(inquiryId, data, adminId) {
    const amount = toPaise(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw ApiError.badRequest('Quote amount must be greater than zero');
    }

    const { inquiry, inquiryType, Model } = await this.findInquiryById(inquiryId);
    if (inquiry.convertedOrder) {
      throw ApiError.conflict('This inquiry is already converted to an order');
    }

    const acceptedQuotes = await InquiryQuote.find({
      inquiry: inquiry._id,
      inquiryType,
      status: { $in: [INQUIRY_QUOTE_STATUSES.ACCEPTED, INQUIRY_QUOTE_STATUSES.CONVERTED] },
    }).lean();
    for (const acceptedQuote of acceptedQuotes) {
      if (acceptedQuote.status === INQUIRY_QUOTE_STATUSES.CONVERTED) {
        throw ApiError.conflict('This inquiry is already converted to an order');
      }

      const acceptedOrder = acceptedQuote.order ? await Order.findById(acceptedQuote.order).select('status paymentStatus').lean() : null;
      if (acceptedOrder?.paymentStatus === 'paid') {
        throw ApiError.conflict('This inquiry already has a paid order');
      }

      const paymentStillActive = acceptedOrder?.status === ORDER_STATUSES.PENDING && acceptedOrder?.paymentStatus !== 'paid';
      if (paymentStillActive) {
        throw ApiError.conflict('This inquiry already has an accepted quote awaiting payment');
      }

      await InquiryQuote.updateOne(
        { _id: acceptedQuote._id },
        { $set: { status: INQUIRY_QUOTE_STATUSES.CANCELLED } }
      );
    }

    await InquiryQuote.updateMany(
      {
        inquiry: inquiry._id,
        inquiryType,
        status: INQUIRY_QUOTE_STATUSES.SENT,
      },
      { $set: { status: INQUIRY_QUOTE_STATUSES.CANCELLED } }
    );

    const token = this.generateToken();
    const version = await InquiryQuote.countDocuments({ inquiry: inquiry._id, inquiryType }) + 1;
    const expiresAt = new Date(Date.now() + (data.expiresInDays || 7) * 24 * 60 * 60 * 1000);
    const quote = await InquiryQuote.create({
      inquiryType,
      inquiry: inquiry._id,
      version,
      amount,
      notes: data.notes || '',
      tokenHash: quoteTokenHash(token),
      status: INQUIRY_QUOTE_STATUSES.SENT,
      sentAt: new Date(),
      expiresAt,
      quotedBy: adminId,
      customer: this.getCustomerSnapshot(inquiry, inquiryType),
    });

    await Model.findByIdAndUpdate(inquiry._id, {
      $set: {
        status: INQUIRY_STATUSES.QUOTED,
        quotedPrice: Number(data.amount),
        latestQuote: quote._id,
        quoteStatus: INQUIRY_QUOTE_STATUSES.SENT,
        quoteSentAt: quote.sentAt,
        quoteExpiresAt: quote.expiresAt,
      },
    });

    const approvalUrl = this.buildApprovalUrl(token);
    setImmediate(async () => {
      try {
        const notificationService = require('../notifications/notification.service');
        await notificationService.sendInquiryQuote(quote, inquiry, inquiryType, approvalUrl);
      } catch (err) {
        logger.warn('[InquiryQuote] Quote notification failed:', err.message);
      }
    });

    return {
      quote: this.getQuoteResponse(quote, inquiry, inquiryType, { approvalUrl }),
      approvalUrl,
    };
  }

  async findQuoteByToken(token) {
    const quote = await InquiryQuote.findOne({ tokenHash: quoteTokenHash(token) }).select('+tokenHash');
    if (!quote) throw ApiError.notFound('Quote link is invalid or expired');

    const Model = inquiryModels[quote.inquiryType];
    const inquiry = await Model.findById(quote.inquiry);
    if (!inquiry) throw ApiError.notFound('Inquiry not found for this quote');

    await this.markExpiredIfNeeded(quote, quote.inquiryType);
    return { quote, inquiry, inquiryType: quote.inquiryType, Model };
  }

  async getPublicQuote(token) {
    const { quote, inquiry, inquiryType } = await this.findQuoteByToken(token);
    const order = quote.order ? await Order.findById(quote.order).select('orderNumber paymentStatus status').lean() : null;
    return this.getQuoteResponse(quote, inquiry, inquiryType, { order });
  }

  async assertDeliverySupported(shippingAddress) {
    const city = shippingAddress.city || '';
    const zone = await DeliveryZone.findOne({
      city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') },
      isActive: true,
    });

    if (!zone) {
      throw ApiError.badRequest(`Delivery not available in ${city}`);
    }

    if (zone.pincodes.length > 0 && !zone.pincodes.includes(shippingAddress.pincode)) {
      throw ApiError.badRequest(`Delivery not available for pincode ${shippingAddress.pincode}`);
    }
  }

  buildOrderItem(inquiry, inquiryType, amount) {
    if (inquiryType === 'corporate') {
      return {
        product: null,
        variant: null,
        name: `Corporate Cake Order - ${inquiry.companyName || 'Inquiry'}`,
        image: inquiry.referenceImages?.[0] || '',
        weight: '',
        flavor: '',
        quantity: 1,
        price: amount,
        isEggless: false,
        cakeMessage: '',
        addOns: [],
      };
    }

    return {
      product: null,
      variant: null,
      name: `Custom Cake - ${inquiry.occasion || 'Design Request'}`,
      image: inquiry.referenceImages?.[0] || '',
      weight: inquiry.weight || '',
      flavor: inquiry.flavor || '',
      quantity: 1,
      price: amount,
      isEggless: false,
      cakeMessage: inquiry.message || '',
      addOns: [],
    };
  }

  buildSpecialInstructions(inquiry, inquiryType, quote) {
    const parts = [
      `Source: ${typeLabel(inquiryType)} inquiry`,
      quote.notes ? `Quote notes: ${quote.notes}` : '',
      inquiryType === 'corporate'
        ? `Requirements: ${inquiry.requirements || ''}`
        : `Design: ${inquiry.designDescription || ''}`,
    ].filter(Boolean);

    return parts.join('\n').slice(0, 500);
  }

  buildPaymentParams(order, payment, shippingAddress) {
    return {
      key_id: env.razorpay.keyId,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      name: env.app.name || 'The Cake Bake',
      description: `Inquiry quote ${order.orderNumber}`,
      order_id: payment.razorpayOrderId,
      prefill: {
        name: shippingAddress.fullName,
        email: order.guestInfo?.email || '',
        contact: shippingAddress.phone,
      },
    };
  }

  async issueGuestTrackingToken(order) {
    if (!order || order.user) return '';
    const token = guestTrackingService.generateToken(order);
    const tokenHash = guestTrackingService.hashToken(token);
    await Order.updateOne(
      { _id: order._id, user: null },
      {
        $set: {
          guestTrackingTokenHash: tokenHash,
          guestTrackingTokenIssuedAt: new Date(),
        },
      }
    );
    return token;
  }

  async buildExistingPaymentResponse(quote, token) {
    const [order, payment] = await Promise.all([
      quote.order ? Order.findById(quote.order) : null,
      quote.payment ? Payment.findById(quote.payment) : null,
    ]);

    if (!order || !payment) {
      throw ApiError.conflict('Quote acceptance is still being processed. Please retry in a moment.');
    }

    if (order.paymentStatus === 'paid') {
      return {
        paid: true,
        orderNumber: order.orderNumber,
        trackingToken: await this.issueGuestTrackingToken(order),
      };
    }

    if (
      order.status === ORDER_STATUSES.PENDING &&
      order.paymentMethod === 'online' &&
      ['created', 'pending', 'authorized'].includes(payment.status) &&
      payment.razorpayOrderId
    ) {
      return {
        quote: await this.getPublicQuote(token),
        order: { _id: order._id, orderNumber: order.orderNumber },
        paymentParams: this.buildPaymentParams(order, payment, order.shippingAddress),
        trackingToken: await this.issueGuestTrackingToken(order),
      };
    }

    await InquiryQuote.updateOne(
      { _id: quote._id },
      { $set: { status: INQUIRY_QUOTE_STATUSES.CANCELLED } }
    );

    throw ApiError.badRequest('This quote payment session is no longer active. Please contact us to reissue the quote.');
  }

  async acceptQuote(token, data) {
    const { quote, inquiry, inquiryType, Model } = await this.findQuoteByToken(token);

    if (quote.status === INQUIRY_QUOTE_STATUSES.ACCEPTED || quote.status === INQUIRY_QUOTE_STATUSES.CONVERTED) {
      return this.buildExistingPaymentResponse(quote, token);
    }

    if (quote.status !== INQUIRY_QUOTE_STATUSES.SENT) {
      throw ApiError.badRequest('This quote is no longer available for payment');
    }

    if (quote.expiresAt <= new Date()) {
      await this.markExpiredIfNeeded(quote, inquiryType);
      throw ApiError.badRequest('This quote has expired. Please contact us for an updated quote.');
    }

    const deliveryDate = new Date(data.deliveryDate);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (deliveryDate < todayStart) {
      throw ApiError.badRequest('Delivery date cannot be in the past');
    }

    await this.assertDeliverySupported(data.shippingAddress);

    const lockedQuote = await InquiryQuote.findOneAndUpdate(
      {
        _id: quote._id,
        status: INQUIRY_QUOTE_STATUSES.SENT,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: INQUIRY_QUOTE_STATUSES.ACCEPTED,
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!lockedQuote) {
      const latest = await InquiryQuote.findById(quote._id);
      return this.buildExistingPaymentResponse(latest, token);
    }

    const session = await mongoose.startSession();
    let result = null;

    try {
      await session.withTransaction(async () => {
        const orderNumber = generateOrderNumber();
        const orderItem = this.buildOrderItem(inquiry, inquiryType, lockedQuote.amount);
        const deliverySlot = normalizeDeliverySlot(data.deliverySlot);
        const customer = this.getCustomerSnapshot(inquiry, inquiryType);
        const user = inquiry.user || null;
        const shippingAddress = {
          fullName: data.shippingAddress.fullName,
          phone: data.shippingAddress.phone,
          addressLine1: data.shippingAddress.addressLine1,
          addressLine2: data.shippingAddress.addressLine2 || '',
          city: data.shippingAddress.city,
          state: data.shippingAddress.state,
          pincode: data.shippingAddress.pincode,
          landmark: data.shippingAddress.landmark || '',
        };

        const orderDocs = await Order.create([{
          orderNumber,
          user,
          guestInfo: user ? {} : {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
          },
          items: [orderItem],
          shippingAddress,
          deliveryDate: new Date(data.deliveryDate),
          deliverySlot,
          deliveryCity: shippingAddress.city,
          subtotal: lockedQuote.amount,
          deliveryCharge: 0,
          discount: 0,
          couponCode: '',
          pointsRedeemed: 0,
          pointsDiscount: 0,
          tax: 0,
          total: lockedQuote.amount,
          status: ORDER_STATUSES.PENDING,
          paymentMethod: 'online',
          paymentStatus: 'pending',
          source: ORDER_SOURCES.INQUIRY,
          sourceInquiryType: inquiryType,
          sourceInquiry: inquiry._id,
          sourceQuote: lockedQuote._id,
          statusHistory: [{
            status: ORDER_STATUSES.PENDING,
            timestamp: new Date(),
            note: 'Inquiry quote accepted; awaiting online payment',
          }],
          specialInstructions: this.buildSpecialInstructions(inquiry, inquiryType, lockedQuote),
        }], { session });

        const order = orderDocs[0];
        const razorpay = getRazorpayInstance();
        const razorpayOrder = await razorpay.orders.create({
          amount: lockedQuote.amount,
          currency: lockedQuote.currency || 'INR',
          receipt: orderNumber,
          notes: {
            orderId: order._id.toString(),
            quoteId: lockedQuote._id.toString(),
            inquiryId: inquiry._id.toString(),
            source: 'inquiry_quote',
          },
        });

        const paymentDocs = await Payment.create([{
          order: order._id,
          user,
          amount: lockedQuote.amount,
          currency: lockedQuote.currency || 'INR',
          razorpayOrderId: razorpayOrder.id,
          status: PAYMENT_STATUSES.PENDING,
          method: 'online',
        }], { session });
        const payment = paymentDocs[0];

        await Order.updateOne({ _id: order._id }, { $set: { paymentId: payment._id } }, { session });
        await InquiryQuote.updateOne(
          { _id: lockedQuote._id },
          {
            $set: {
              status: INQUIRY_QUOTE_STATUSES.ACCEPTED,
              acceptedAt: lockedQuote.acceptedAt || new Date(),
              order: order._id,
              payment: payment._id,
            },
          },
          { session }
        );
        await Model.updateOne(
          { _id: inquiry._id },
          {
            $set: {
              quoteStatus: INQUIRY_QUOTE_STATUSES.ACCEPTED,
              quoteAcceptedAt: lockedQuote.acceptedAt || new Date(),
            },
          },
          { session }
        );

        let trackingToken = '';
        if (!user) {
          const tracking = await guestTrackingService.attachTokenToOrder(order, session);
          trackingToken = tracking.token;
        }

        result = {
          quote: this.getQuoteResponse(lockedQuote, inquiry, inquiryType),
          order: { _id: order._id, orderNumber: order.orderNumber },
          paymentParams: this.buildPaymentParams(order, payment, shippingAddress),
          trackingToken,
        };
      });
    } catch (err) {
      await InquiryQuote.updateOne(
        { _id: lockedQuote._id, order: null },
        {
          $set: { status: INQUIRY_QUOTE_STATUSES.SENT },
          $unset: { acceptedAt: '' },
        }
      ).catch(() => {});
      throw err;
    } finally {
      session.endSession();
    }

    return result;
  }

  async verifyQuotePayment(token, data) {
    const { quote } = await this.findQuoteByToken(token);
    if (!quote.order || !quote.payment) {
      throw ApiError.badRequest('This quote has not been accepted yet');
    }

    const body = `${data.razorpayOrderId}|${data.razorpayPaymentId}`;
    paymentService.verifySignature(body, data.razorpaySignature, env.razorpay.keySecret, 'Payment verification failed - invalid signature');

    const payment = await Payment.findOneAndUpdate(
      {
        _id: quote.payment,
        order: quote.order,
        razorpayOrderId: data.razorpayOrderId,
        $or: [
          { status: { $in: CAPTURE_READY_PAYMENT_STATUSES } },
          { status: PAYMENT_STATUSES.CAPTURED, razorpayPaymentId: data.razorpayPaymentId },
        ],
      },
      {
        $set: {
          razorpayPaymentId: data.razorpayPaymentId,
          razorpaySignature: data.razorpaySignature,
          status: PAYMENT_STATUSES.CAPTURED,
        },
      },
      { new: true }
    );

    if (!payment) {
      const existingPayment = await Payment.findById(quote.payment);
      const existingOrder = await Order.findById(quote.order).lean();
      if (existingPayment?.status === PAYMENT_STATUSES.CAPTURED && existingOrder?.paymentStatus === 'paid') {
        return {
          success: true,
          orderNumber: existingOrder.orderNumber,
          paymentId: existingPayment.razorpayPaymentId,
          trackingToken: await this.issueGuestTrackingToken(existingOrder),
        };
      }
      throw ApiError.badRequest('This payment session is no longer active. Please contact support.');
    }

    const finalized = await paymentService.confirmCapturedPayment(payment, {
      userId: payment.user || null,
      note: 'Inquiry quote payment verified',
      clearCart: false,
      sendNotification: true,
    });

    cache.del('admin:dashboard');

    return {
      success: true,
      orderNumber: finalized.order?.orderNumber,
      paymentId: payment.razorpayPaymentId,
      trackingToken: await this.issueGuestTrackingToken(finalized.order),
    };
  }
}

module.exports = new InquiryQuoteService();
module.exports.quoteTokenHash = quoteTokenHash;
module.exports.toPaise = toPaise;
