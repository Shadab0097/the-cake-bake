const express = require('express');
const router = express.Router();
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const DeliveryZone = require('../../models/DeliveryZone');
const { generateOrderNumber } = require('../../utils/helpers');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const cache = require('../../utils/cache');

/**
 * POST /api/v1/guest-checkout
 *
 * Places a COD order without requiring authentication.
 * Body:
 *   guestInfo: { name, email, phone }
 *   shippingAddress: { fullName, phone, addressLine1, city, state, pincode, landmark? }
 *   items: [{ name, image?, weight?, price, quantity, isEggless?, cakeMessage? }]
 *   deliveryDate: ISO date string
 *   deliverySlot: string  e.g. "10:00 AM – 12:00 PM"
 *   subtotal: number (paise)
 *   deliveryCharge: number (paise)
 *   total: number (paise)
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      guestInfo,
      shippingAddress,
      items,
      deliveryDate,
      deliverySlot,
      subtotal,
      deliveryCharge = 0,
      total,
    } = req.body;

    // ── Basic validation ─────────────────────────────────────────────────────
    if (!guestInfo?.name || !guestInfo?.email || !guestInfo?.phone) {
      throw ApiError.badRequest('Guest name, email, and phone are required');
    }

    if (
      !shippingAddress?.fullName ||
      !shippingAddress?.phone ||
      !shippingAddress?.addressLine1 ||
      !shippingAddress?.city ||
      !shippingAddress?.state ||
      !shippingAddress?.pincode
    ) {
      throw ApiError.badRequest('Complete shipping address is required');
    }

    if (!items || items.length === 0) {
      throw ApiError.badRequest('Order must contain at least one item');
    }

    if (!deliveryDate) {
      throw ApiError.badRequest('Delivery date is required');
    }

    if (!total || total <= 0) {
      throw ApiError.badRequest('Invalid order total');
    }

    // ── Delivery zone check ──────────────────────────────────────────────────
    const zone = await DeliveryZone.findOne({
      city: { $regex: new RegExp(`^${shippingAddress.city}$`, 'i') },
      isActive: true,
    });

    if (!zone) {
      throw ApiError.badRequest(`Delivery not available in ${shippingAddress.city}`);
    }

    if (zone.pincodes.length > 0 && !zone.pincodes.includes(shippingAddress.pincode)) {
      throw ApiError.badRequest(`Delivery not available for pincode ${shippingAddress.pincode}`);
    }

    // ── Normalise delivery slot ──────────────────────────────────────────────
    let slotObj = deliverySlot || {};
    if (typeof slotObj === 'string') {
      const parts = slotObj.split('–').map((s) => s.trim());
      slotObj = { label: slotObj, startTime: parts[0] || '', endTime: parts[1] || '' };
    }

    // ── Build order items snapshot ───────────────────────────────────────────
    const orderItems = items.map((item) => ({
      name: item.name,
      image: item.image || '',
      weight: item.weight || '',
      flavor: item.flavor || '',
      quantity: item.quantity,
      price: item.price,
      isEggless: item.isEggless || false,
      cakeMessage: item.cakeMessage || '',
      addOns: item.addOns || [],
    }));

    // ── Create order ─────────────────────────────────────────────────────────
    const orderNumber = generateOrderNumber();

    const order = await Order.create({
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
      subtotal: subtotal || total,
      deliveryCharge,
      discount: 0,
      couponCode: '',
      tax: 0,
      total,
      status: ORDER_STATUSES.PENDING,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      statusHistory: [{ status: ORDER_STATUSES.PENDING, timestamp: new Date(), note: 'Guest order created' }],
    });

    // ── Create COD payment record ─────────────────────────────────────────────
    await Payment.create({
      order: order._id,
      user: null,              // Payment.user will need to be optional too (see note below)
      amount: total,
      currency: 'INR',
      status: PAYMENT_STATUSES.PENDING,
      method: 'cod',
    });

    // Bust dashboard cache so the new order appears immediately
    cache.del('admin:dashboard');

    return ApiResponse.created({ order }, 'Guest order placed successfully').send(res);
  })
);

module.exports = router;
