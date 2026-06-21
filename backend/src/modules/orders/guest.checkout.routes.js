const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Joi = require('joi');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const AddOn = require('../../models/AddOn');
const { generateOrderNumber } = require('../../utils/helpers');
const serviceability = require('../delivery/serviceability');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const { sanitize } = require('../../utils/xssSanitizer');
const cache = require('../../utils/cache');
const logger = require('../../middleware/logger');
const idempotencyService = require('./idempotency.service');
const inventoryReservationService = require('./inventoryReservation.service');
const guestTrackingService = require('./guestTracking.service');
const codAbuseService = require('./codAbuse.service');

// ── Joi validation schema for guest checkout ──────────────────────────────────
const guestCheckoutSchema = Joi.object({
  guestInfo: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().lowercase().trim().required(),
    phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).required().messages({
      'string.pattern.base': 'Guest phone must be 10-15 digits',
    }),
  }).required(),

  shippingAddress: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    phone: Joi.string().trim().pattern(/^\+?[0-9]{10,15}$/).required(),
    addressLine1: Joi.string().trim().min(5).max(200).required(),
    addressLine2: Joi.string().trim().max(200).allow('').default(''),
    city: Joi.string().trim().min(2).max(100).required(),
    state: Joi.string().trim().min(2).max(100).required(),
    pincode: Joi.string().trim().pattern(/^[1-9][0-9]{5}$/).required().messages({
      'string.pattern.base': 'Pincode must be a valid 6-digit Indian pincode',
    }),
    landmark: Joi.string().trim().max(200).allow('').default(''),
  }).required(),

  // Items: array of { productId, variantId, quantity, addOns?, isEggless?, cakeMessage? }
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      variantId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).max(50).required(),
      addOns: Joi.array().items(Joi.string()).default([]),
      isEggless: Joi.boolean().default(false),
      cakeMessage: Joi.string().trim().max(100).allow('').default(''),
    })
  ).min(1).required(),

  deliveryDate: Joi.date().iso().min('now').required().messages({
    'date.min': 'Delivery date cannot be in the past',
  }),
  deliverySlot: Joi.alternatives()
    .try(Joi.object({ label: Joi.string().allow(''), startTime: Joi.string().allow(''), endTime: Joi.string().allow('') }), Joi.string().allow(''))
    .default(''),
});

/**
 * POST /api/v1/guest-checkout
 *
 * Places a COD order without requiring authentication.
 * FIX: Server-side price recalculation — never trusts client-supplied prices.
 * FIX: Full Joi validation with XSS sanitization.
 * FIX: Wrapped in MongoDB transaction for atomicity.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // ── Validate input with Joi ──────────────────────────────────────────────
    const { error, value } = guestCheckoutSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        code: (d.type || 'invalid').toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
        message: d.message.replace(/"/g, ''),
      }));
      const [first] = errors;
      const extra = errors.length - 1;
      const summary = extra > 0
        ? `${first.message} (and ${extra} more validation ${extra === 1 ? 'issue' : 'issues'})`
        : first.message;
      throw ApiError.badRequest(summary, errors, 'VALIDATION_ERROR');
    }

    const { guestInfo, shippingAddress, items, deliveryDate, deliverySlot } = value;
    const requestContext = codAbuseService.buildRequestContext(req);

    // ── XSS sanitize string fields ──────────────────────────────────────────
    guestInfo.name = sanitize(guestInfo.name);
    shippingAddress.fullName = sanitize(shippingAddress.fullName);
    shippingAddress.addressLine1 = sanitize(shippingAddress.addressLine1);
    shippingAddress.addressLine2 = sanitize(shippingAddress.addressLine2 || '');
    shippingAddress.city = sanitize(shippingAddress.city);
    shippingAddress.state = sanitize(shippingAddress.state);
    shippingAddress.landmark = sanitize(shippingAddress.landmark || '');

    const result = await idempotencyService.execute({
      key: idempotencyService.getKeyFromRequest(req),
      scope: 'guest_checkout',
      guestFingerprint: idempotencyService.guestFingerprint(guestInfo),
      payload: value,
      handler: async () => {
    // ── Serviceability gate (live zone by pincode) + same-day cutoff ─────────
    const zone = await serviceability.resolveServiceableZone({
      pincode: shippingAddress.pincode,
      city: shippingAddress.city,
    });
    serviceability.assertDeliveryDateAllowed(zone, deliveryDate);

    // ── FIX: Server-side price calculation ──────────────────────────────────
    // Load all products + variants + addons from DB. Never trust client prices.
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const [product, variant] = await Promise.all([
        Product.findOne({ _id: item.productId, isActive: true }),
        Variant.findOne({ _id: item.variantId, product: item.productId, isActive: true }),
      ]);

      if (!product) {
        throw ApiError.badRequest(`Product not found or unavailable`, [], 'PRODUCT_NOT_FOUND');
      }
      if (!variant) {
        throw ApiError.badRequest(`Variant not found or unavailable for product "${product.name}"`, [], 'VARIANT_NOT_FOUND');
      }
      if (variant.stock < item.quantity) {
        throw ApiError.badRequest(`Insufficient stock for "${product.name}" (${variant.weight})`, [{ field: 'quantity', code: 'INSUFFICIENT_STOCK', message: `Insufficient stock for "${product.name}" (${variant.weight})` }], 'INSUFFICIENT_STOCK');
      }

      // Server-calculated unit price
      let unitPrice = variant.price;
      if (item.isEggless && product.egglessExtraPrice) {
        unitPrice += product.egglessExtraPrice;
      }

      // Validate and price add-ons from DB
      let addOnSnapshots = [];
      if (item.addOns && item.addOns.length > 0) {
        const validAddOns = await AddOn.find({ _id: { $in: item.addOns }, isActive: true });
        addOnSnapshots = validAddOns.map((a) => ({ name: a.name, price: a.price }));
      }

      const addOnTotal = addOnSnapshots.reduce((sum, a) => sum + a.price, 0);
      const lineTotal = (unitPrice + addOnTotal) * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        product: product._id,
        variant: variant._id,
        name: product.name,
        image: product.images?.[0]?.url || '',
        weight: variant.weight,
        flavor: '',
        quantity: item.quantity,
        price: unitPrice,
        cost: variant.costPrice || 0,
        isEggless: item.isEggless,
        cakeMessage: sanitize(item.cakeMessage || ''),
        addOns: addOnSnapshots,
      });
    }

    // Delivery charge from zone (server-calculated)
    let deliveryCharge = zone.deliveryCharge || 0;
    if (zone.freeDeliveryAbove > 0 && subtotal >= zone.freeDeliveryAbove) {
      deliveryCharge = 0;
    }

    const total = subtotal + deliveryCharge;
    if (total <= 0) throw ApiError.badRequest('Invalid order total', [], 'INVALID_ORDER_TOTAL');

    const { getCommerceConfig } = require('../../utils/commerceSettings');
    const commerceConfig = await getCommerceConfig();
    const codRiskAssessment = await codAbuseService.assertCanUseCOD({
      guestInfo,
      shippingAddress,
      total,
      isGuest: true,
      requestContext,
      globalCodEnabled: commerceConfig.codEnabled,
      zoneCodEnabled: zone?.codEnabled !== false,
    });

    // ── Normalise delivery slot ──────────────────────────────────────────────
    let slotObj = deliverySlot || {};
    if (typeof slotObj === 'string') {
      const parts = slotObj.split('–').map((s) => s.trim());
      slotObj = { label: slotObj, startTime: parts[0] || '', endTime: parts[1] || '' };
    }

    const orderNumber = generateOrderNumber();

    // ── FIX: Wrap in MongoDB transaction ────────────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.create([{
        orderNumber,
        user: null,                  // guest — no user account
        guestInfo: {
          name: guestInfo.name,
          email: guestInfo.email,
          phone: guestInfo.phone,
        },
        items: orderItems,
        shippingAddress: {
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode,
          landmark: shippingAddress.landmark || '',
        },
        deliveryDate: new Date(deliveryDate),
        deliverySlot: slotObj,
        deliveryCity: shippingAddress.city,
        branchId: zone?.branchId || commerceConfig.defaultBranchId || null,
        subtotal,
        deliveryCharge,
        discount: 0,
        couponCode: '',
        tax: 0,
        total,
        status: ORDER_STATUSES.CONFIRMED,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        checkoutIp: requestContext.ip || '',
        checkoutUserAgent: requestContext.userAgent || '',
        codRisk: codAbuseService.buildRiskSnapshot(codRiskAssessment),
        statusHistory: [{ status: ORDER_STATUSES.CONFIRMED, timestamp: new Date(), note: 'Guest COD order confirmed' }],
      }], { session });

      const createdOrder = order[0];

      await inventoryReservationService.reserveForOrder({
        order: createdOrder,
        items: orderItems,
        user: null,
        guestInfo,
        status: 'confirmed',
        reason: 'Guest COD order confirmed',
        session,
      });

      // ── Create COD payment record ────────────────────────────────────────
      await Payment.create([{
        order: createdOrder._id,
        user: null,
        amount: total,
        currency: 'INR',
        status: PAYMENT_STATUSES.PENDING,
        method: 'cod',
      }], { session });

      const tracking = await guestTrackingService.attachTokenToOrder(createdOrder, session);

      await session.commitTransaction();

      // Bust dashboard cache so the new order appears immediately
      cache.del('admin:dashboard');

      // Send order confirmation to guest via email + WhatsApp (fire-and-forget)
      setImmediate(async () => {
        try {
          const notificationService = require('../notifications/notification.service');
          await notificationService.sendOrderConfirmation(createdOrder, null, { trackingToken: tracking.token });
        } catch (err) {
          logger.warn('[GuestCheckout] Order notification failed:', err.message);
        }
      });

      return {
        order: guestTrackingService.buildPublicOrder(createdOrder),
        trackingToken: tracking.token,
        trackingUrl: tracking.trackingUrl,
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('[GuestCheckout] Transaction failed:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to place guest order. Please try again.', [], 'GUEST_ORDER_CREATION_FAILED');
    } finally {
      session.endSession();
    }
      },
    });

    return ApiResponse.created(result, 'Guest order placed successfully').send(res);
  })
);

module.exports = router;
