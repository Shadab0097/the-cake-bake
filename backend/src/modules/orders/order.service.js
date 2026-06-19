const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Cart = require('../../models/Cart');
const Variant = require('../../models/Variant');
const Address = require('../../models/Address');
const ApiError = require('../../utils/ApiError');
const { generateOrderNumber, escapeRegex } = require('../../utils/helpers');
const serviceability = require('../delivery/serviceability');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const { getRazorpayInstance } = require('../../config/razorpay');
const { env } = require('../../config/env');
const logger = require('../../middleware/logger');
const cache = require('../../utils/cache');
const { canMoveOnlineOrderToStatus, cancelUnpaidOnlineOrder } = require('./order.lifecycle');
const inventoryReservationService = require('./inventoryReservation.service');
const couponUsageService = require('../coupons/couponUsage.service');
const loyaltyService = require('../loyalty/loyalty.service');
const codAbuseService = require('./codAbuse.service');
const cancellationService = require('./cancellation.service');
const refundService = require('../payments/refund.service');

class OrderService {
  /**
   * Resolve address: either from DB (addressId) or inline (shippingAddress)
   * Optionally saves inline address to DB if userId provided
   */
  async resolveAddress(userId, addressId, shippingAddress, options = {}) {
    const { saveInline = false, session = null } = options;

    if (addressId) {
      const addressQuery = Address.findOne({ _id: addressId, user: userId });
      const address = session ? await addressQuery.session(session) : await addressQuery;
      if (!address) throw ApiError.badRequest('Invalid delivery address', [{ field: 'addressId', code: 'INVALID_DELIVERY_ADDRESS', message: 'Invalid delivery address' }], 'INVALID_DELIVERY_ADDRESS');
      return address;
    }

    if (shippingAddress) {
      if (!saveInline) {
        return {
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state,
          pincode: shippingAddress.pincode,
          landmark: shippingAddress.landmark || '',
        };
      }

      const address = new Address({
        user: userId,
        ...shippingAddress,
      });
      await address.save({ session });
      return address;
    }

    throw ApiError.badRequest('Delivery address is required', [{ field: 'shippingAddress', code: 'DELIVERY_ADDRESS_REQUIRED', message: 'Delivery address is required' }], 'DELIVERY_ADDRESS_REQUIRED');
  }

  /**
   * Validate checkout data before order creation
   */
  async validateCheckout(userId, checkoutData) {
    const { addressId, deliveryDate, deliverySlotId, shippingAddress } = checkoutData;

    // Get cart
    const cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'name images isActive basePrice egglessExtraPrice')
      .populate('items.variant', 'weight price stock isActive')
      .populate('items.addOns', 'name price')
      .populate('appliedCoupon');

    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest('Cart is empty', [], 'CART_EMPTY');
    }

    // Validate all items are still available
    for (const item of cart.items) {
      if (!item.product?.isActive) {
        throw ApiError.badRequest(`Product "${item.snapshotName}" is no longer available`, [], 'PRODUCT_UNAVAILABLE');
      }
      if (!item.variant?.isActive) {
        throw ApiError.badRequest(`Variant for "${item.snapshotName}" is no longer available`, [], 'VARIANT_UNAVAILABLE');
      }
      if (item.variant.stock < item.quantity) {
        throw ApiError.badRequest(`Insufficient stock for "${item.snapshotName}"`, [{ field: 'quantity', code: 'INSUFFICIENT_STOCK', message: `Insufficient stock for "${item.snapshotName}"` }], 'INSUFFICIENT_STOCK');
      }
    }

    // Validate address
    const address = await this.resolveAddress(userId, addressId, shippingAddress);

    // Serviceability gate (live zone, matched by pincode) + same-day cutoff.
    const zone = await serviceability.resolveServiceableZone({
      pincode: address.pincode,
      city: address.city,
    });
    serviceability.assertDeliveryDateAllowed(zone, deliveryDate);

    return { cart, address, zone };
  }

  calculateCouponDiscount(coupon, subtotal) {
    return couponUsageService.calculateDiscount(coupon, subtotal);
  }

  async validateCouponForCheckoutSession(couponCode, userId, subtotal, session) {
    return couponUsageService.validateForCheckout({
      couponCode,
      userId,
      subtotal,
      session,
    });
  }

  async consumeCouponUsageSession(coupon, userId, orderId, session) {
    return couponUsageService.consumeForOrder({
      coupon,
      userId,
      orderId,
      session,
    });
  }

  async calculateLoyaltyRedemptionSession(userId, redeemPoints, prePointsTotal, session) {
    return loyaltyService.calculateRedemption({
      userId,
      redeemPoints,
      prePointsTotal,
      session,
    });
  }

  async deductRedeemedPointsSession(userId, pointsRedeemed, orderId, orderNumber, session) {
    return loyaltyService.redeemForOrder({
      userId,
      pointsRedeemed,
      orderId,
      orderNumber,
      session,
    });
  }

  /**
   * Create order and Razorpay payment order
   */
  async createOrder(userId, checkoutData, options = {}) {
    const { requestContext = {} } = options;
    const { addressId, deliveryDate, shippingAddress, specialInstructions, isGift, giftMessage, paymentMethod = 'cod', redeemPoints = false } = checkoutData;

    // Normalise deliverySlot — frontend sends a plain string like "10:00 AM – 12:00 PM"
    let deliverySlot = checkoutData.deliverySlot || {};
    if (typeof deliverySlot === 'string') {
      const parts = deliverySlot.split('–').map((s) => s.trim());
      deliverySlot = {
        label: deliverySlot,
        startTime: parts[0] || '',
        endTime: parts[1] || '',
      };
    }

    const { cart, address, zone } = await this.validateCheckout(userId, checkoutData);

    // Build order items snapshot
    const orderItems = cart.items.map((item) => {
      let unitPrice = item.variant.price;
      if (item.isEggless && item.product.egglessExtraPrice) {
        unitPrice += item.product.egglessExtraPrice;
      }

      const addOnSnapshots = (item.addOns || []).map((addon) => ({
        name: addon.name,
        price: addon.price,
      }));

      return {
        product: item.product._id,
        variant: item.variant._id,
        name: item.product.name,
        image: item.product.images?.[0]?.url || '',
        weight: item.variant.weight,
        flavor: '',
        quantity: item.quantity,
        price: unitPrice,
        isEggless: item.isEggless,
        cakeMessage: item.cakeMessage,
        addOns: addOnSnapshots,
      };
    });

    // Compute totals
    let subtotal = 0;
    orderItems.forEach((item) => {
      const addOnTotal = item.addOns.reduce((sum, a) => sum + a.price, 0);
      subtotal += (item.price + addOnTotal) * item.quantity;
    });

    // Delivery charge
    let deliveryCharge = zone.deliveryCharge || 0;
    if (zone.freeDeliveryAbove > 0 && subtotal >= zone.freeDeliveryAbove) {
      deliveryCharge = 0;
    }

    // Coupon discount
    let discount = 0;
    let couponCode = '';
    if (cart.appliedCoupon) {
      const coupon = cart.appliedCoupon;
      couponCode = coupon.code;
      if (subtotal >= (coupon.minOrderAmount || 0)) {
        if (coupon.type === 'percentage') {
          discount = Math.round((subtotal * coupon.value) / 100);
          if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        } else {
          discount = coupon.value;
        }
      }
    }

    let pointsRedeemed = 0;
    let pointsDiscount = 0;

    let total = subtotal + deliveryCharge - discount - pointsDiscount;
    if (total <= 0) throw ApiError.badRequest('Invalid order total', [], 'INVALID_ORDER_TOTAL');

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order using transaction session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let appliedCoupon = null;
      if (couponCode) {
        const couponResult = await this.validateCouponForCheckoutSession(couponCode, userId, subtotal, session);
        appliedCoupon = couponResult.coupon;
        discount = couponResult.discount;
      }

      const loyaltyResult = await this.calculateLoyaltyRedemptionSession(
        userId,
        redeemPoints,
        subtotal + deliveryCharge - discount,
        session
      );
      pointsRedeemed = loyaltyResult.pointsRedeemed;
      pointsDiscount = loyaltyResult.pointsDiscount;
      total = subtotal + deliveryCharge - discount - pointsDiscount;
      if (total <= 0) throw ApiError.badRequest('Invalid order total', [], 'INVALID_ORDER_TOTAL');

      let orderAddress = address;
      if (!addressId && shippingAddress && checkoutData.saveAddress) {
        orderAddress = await this.resolveAddress(userId, null, shippingAddress, { saveInline: true, session });
      }
      let codRiskAssessment = null;
      if (paymentMethod === 'cod') {
        codRiskAssessment = await codAbuseService.assertCanUseCOD({
          userId,
          shippingAddress: orderAddress,
          total,
          isGuest: false,
          requestContext,
          session,
        });
      }

      const order = await Order.create([{
        orderNumber,
        user: userId,
        items: orderItems,
        shippingAddress: {
          fullName: orderAddress.fullName,
          phone: orderAddress.phone,
          addressLine1: orderAddress.addressLine1,
          addressLine2: orderAddress.addressLine2,
          city: orderAddress.city,
          state: orderAddress.state,
          pincode: orderAddress.pincode,
          landmark: orderAddress.landmark,
        },
        deliveryDate: new Date(deliveryDate),
        deliverySlot: deliverySlot || {},
        deliveryCity: orderAddress.city,
        subtotal,
        deliveryCharge,
        discount,
        couponCode,
        pointsRedeemed,
        pointsDiscount,
        tax: 0,
        total,
        status: paymentMethod === 'cod' ? ORDER_STATUSES.CONFIRMED : ORDER_STATUSES.PENDING,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: 'pending',
        checkoutIp: requestContext.ip || '',
        checkoutUserAgent: requestContext.userAgent || '',
        codRisk: codRiskAssessment ? codAbuseService.buildRiskSnapshot(codRiskAssessment) : undefined,
        statusHistory: [{
          status: paymentMethod === 'cod' ? ORDER_STATUSES.CONFIRMED : ORDER_STATUSES.PENDING,
          timestamp: new Date(),
          note: paymentMethod === 'cod' ? 'COD order confirmed' : 'Order created',
        }],
        specialInstructions: specialInstructions || '',
        isGift: isGift || false,
        giftMessage: giftMessage || '',
      }], { session });

      const createdOrder = order[0];

      const reservationExpiresAt = paymentMethod === 'online'
        ? new Date(Date.now() + env.orders.onlinePaymentExpiryMinutes * 60 * 1000)
        : null;

      await inventoryReservationService.reserveForOrder({
        order: createdOrder,
        items: orderItems,
        user: userId,
        status: paymentMethod === 'cod' ? 'confirmed' : 'reserved',
        expiresAt: reservationExpiresAt,
        reason: paymentMethod === 'cod' ? 'COD order confirmed' : 'Awaiting online payment',
        session,
      });

      // ── Deduct loyalty points (inside transaction for atomicity) ──────────
      await this.deductRedeemedPointsSession(userId, pointsRedeemed, createdOrder._id, orderNumber, session);

      if (appliedCoupon) {
        await this.consumeCouponUsageSession(appliedCoupon, userId, createdOrder._id, session);
      }

      // Clear COD cart immediately. Online cart is cleared after payment verification.
      if (paymentMethod === 'cod' && cart && cart.items.length > 0 && orderItems.length > 0) {
        // Remove items from cart that were ordered (match by product + variant)
        cart.items = cart.items.filter((item) => {
          return !orderItems.some((orderedItem) => {
            const orderedProduct = String(orderedItem.product._id || orderedItem.product);
            const orderedVariant = String(orderedItem.variant._id || orderedItem.variant);
            const cartProduct = item.product ? String(item.product._id || item.product) : '';
            const cartVariant = item.variant ? String(item.variant._id || item.variant) : '';
            return orderedProduct === cartProduct && orderedVariant === cartVariant;
          });
        });

        // Clear applied coupon since order was placed
        cart.appliedCoupon = null;
        await cart.save({ session });
      }

      // ── COD: decrement stock + record coupon usage inside transaction ────────
      if (paymentMethod === 'cod') {
        // Create a payment record marked as COD
        await Payment.create([{
          order: createdOrder._id,
          user: userId,
          amount: total,
          currency: 'INR',
          status: PAYMENT_STATUSES.PENDING,
          method: 'cod',
        }], { session });

        await session.commitTransaction();
        cache.del('admin:dashboard');

        // Send order confirmation notification for COD orders (fire-and-forget)
        setImmediate(async () => {
          try {
            const notificationService = require('../notifications/notification.service');
            await notificationService.sendOrderConfirmation(createdOrder);
          } catch (err) {
            logger.warn('[Order] COD confirmation notification failed:', err.message);
          }
        });

        return { order: createdOrder };
      }

      // ── Online: create Razorpay order ────────────────────────────────────────
      const razorpay = getRazorpayInstance();
      const razorpayOrder = await razorpay.orders.create({
        amount: total, // already in paise
        currency: 'INR',
        receipt: orderNumber,
        notes: { orderId: createdOrder._id.toString(), userId: userId.toString() },
      });

      // Create payment record
      const payment = await Payment.create([{
        order: createdOrder._id,
        user: userId,
        amount: total,
        currency: 'INR',
        razorpayOrderId: razorpayOrder.id,
        status: PAYMENT_STATUSES.PENDING,
        method: 'online',
      }], { session });

      // Link paymentId back onto the order
      await Order.findByIdAndUpdate(
        createdOrder._id,
        { paymentId: payment[0]._id },
        { session }
      );

      await session.commitTransaction();

      return {
        order: createdOrder,
        paymentParams: {
          key_id: process.env.RAZORPAY_KEY_ID,
          amount: total,
          currency: 'INR',
          name: process.env.APP_NAME || 'The Cake Bake',
          description: `Order ${orderNumber}`,
          order_id: razorpayOrder.id,
          prefill: {
            name: orderAddress.fullName,
            contact: orderAddress.phone,
          },
        },
      };
    } catch (error) {
      await session.abortTransaction();
      // FIX: Use logger instead of console.error so errors appear in log files
      logger.error('Order creation failed:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create order. Please try again.', [], 'ORDER_CREATION_FAILED');
    } finally {
      session.endSession();
    }
  }

  /**
   * Decrement stock within a transaction session (for COD orders)
   */
  async decrementStockSession(orderItems, session, orderNumber) {
    const bulkOps = orderItems
      .filter((item) => item.product)
      .map((item) => ({
        updateOne: {
          filter: { product: item.product, weight: item.weight, stock: { $gte: item.quantity } },
          update: { $inc: { stock: -item.quantity } },
        },
      }));

    if (bulkOps.length > 0) {
      const result = await Variant.bulkWrite(bulkOps, { session });
      const notUpdated = bulkOps.length - result.modifiedCount;
      if (notUpdated > 0) {
        logger.warn(`[Order] ${notUpdated} item(s) had insufficient stock during COD order ${orderNumber} — stock guard prevented decrement`);
      }
    }
  }

  /**
   * Record coupon usage within a transaction session (for COD orders)
   */
  async recordCouponUsageSession(couponCode, userId, orderId, session) {
    return couponUsageService.consumeForOrder({
      couponCode,
      userId,
      orderId,
      session,
    });
  }

  /**
   * Get user's order history
   */
  async getOrders(userId, query) {
    const { page, limit, skip } = parsePagination(query);

    const [orders, total] = await Promise.all([
      Order.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ user: userId }),
    ]);

    return paginatedResponse(orders, total, page, limit);
  }

  /**
   * Get order detail by order number
   */
  async getOrderByNumber(userId, orderNumber) {
    const order = await Order.findOne({ orderNumber, user: userId })
      .populate('paymentId')
      .lean();

    if (!order) throw ApiError.notFound('Order not found', [], 'ORDER_NOT_FOUND');
    return {
      ...order,
      cancellationPolicy: cancellationService.evaluate(order, { actor: 'customer' }),
    };
  }

  /**
   * Cancel order (user-initiated) — fully transactional
   */
  async cancelOrder(userId, orderNumber) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findOne({ orderNumber, user: userId }).session(session);
      if (!order) throw ApiError.notFound('Order not found', [], 'ORDER_NOT_FOUND');

      const policy = cancellationService.evaluate(order, { actor: 'customer' });
      if (!policy.cancellable) throw ApiError.badRequest(policy.reason, [], 'ORDER_NOT_CANCELLABLE');

      if (order.paymentMethod === 'online' && order.paymentStatus !== 'paid') {
        const result = await cancelUnpaidOnlineOrder(order, {
          session,
          paymentStatus: 'failed',
          paymentRecordStatus: PAYMENT_STATUSES.FAILED,
          note: 'Cancelled by customer before payment completion',
          paymentEvent: 'customer.cancel_unpaid_online_order',
          paymentPayload: { userId },
        });

        if (!result.changed) {
          throw ApiError.badRequest('Order is no longer awaiting online payment', [], 'ORDER_NOT_AWAITING_PAYMENT');
        }

        await session.commitTransaction();
        const cancelledOrder = result.order;

        setImmediate(async () => {
          try {
            const notificationService = require('../notifications/notification.service');
            await notificationService.sendStatusUpdate(cancelledOrder, 'cancelled');
          } catch (err) {
            logger.warn('[Order] Cancel notification failed:', err.message);
          }
        });

        return cancelledOrder;
      }

      const payment = await Payment.findOne({ order: order._id }).session(session);
      order.status = ORDER_STATUSES.CANCELLED;
      order.cancellation = {
        requestedBy: 'customer',
        reason: 'Cancelled by customer',
        cancelledAt: new Date(),
        policyCode: policy.code,
      };
      order.statusHistory.push({
        status: ORDER_STATUSES.CANCELLED,
        timestamp: new Date(),
        note: 'Cancelled by customer',
      });

      await inventoryReservationService.releaseForOrder(order, session, {
        reason: 'Cancelled by customer',
      });

      // ── Refund redeemed loyalty points (inside transaction) ──────────────
      await loyaltyService.restoreForOrder(order, {
        session,
        eventType: loyaltyService.EVENTS.ORDER_CANCELLED_RESTORE,
        reason: `Points refunded for cancelled order ${order.orderNumber}`,
      });

      await couponUsageService.releaseForOrder(order, session);

      if (order.paymentMethod === 'cod') {
        order.paymentStatus = 'failed';
        if (payment) {
          payment.status = PAYMENT_STATUSES.FAILED;
          payment.webhookEvents.push({
            event: 'customer.cancel_cod_order',
            payload: { userId },
            receivedAt: new Date(),
          });
          await payment.save({ session });
        }
      } else if (policy.refundRequired) {
        await refundService.requestForOrder({
          order,
          payment,
          amount: policy.refundAmount,
          reason: 'Customer cancelled paid online order',
          requestedBy: 'customer',
          requestedByUser: userId,
          session,
        });
      }

      await order.save({ session });
      await session.commitTransaction();

      // Send cancellation notification (fire-and-forget, outside transaction)
      setImmediate(async () => {
        try {
          const notificationService = require('../notifications/notification.service');
          await notificationService.sendStatusUpdate(order, 'cancelled');
        } catch (err) {
          logger.warn('[Order] Cancel notification failed:', err.message);
        }
      });

      return order;
    } catch (error) {
      await session.abortTransaction();
      if (error instanceof ApiError) throw error;
      logger.error('[Order] cancelOrder transaction failed:', error);
      throw ApiError.internal('Failed to cancel order. Please try again.', [], 'ORDER_CANCELLATION_FAILED');
    } finally {
      session.endSession();
    }
  }

  async cancelOrderByAdmin(orderId, note, adminId) {
    const session = await mongoose.startSession();

    try {
      let cancelledOrderId = null;
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw ApiError.notFound('Order not found', [], 'ORDER_NOT_FOUND');

        const policy = cancellationService.evaluate(order, { actor: 'admin' });
        if (!policy.cancellable) throw ApiError.badRequest(policy.reason, [], 'ORDER_NOT_CANCELLABLE');

        if (order.paymentMethod === 'online' && order.paymentStatus !== 'paid') {
          const result = await cancelUnpaidOnlineOrder(order, {
            session,
            paymentStatus: 'failed',
            paymentRecordStatus: PAYMENT_STATUSES.FAILED,
            note: note || 'Cancelled by admin before payment completion',
            paymentEvent: 'admin.cancel_unpaid_online_order',
            paymentPayload: { adminId },
          });

          if (!result.changed) {
            throw ApiError.badRequest('Order is no longer awaiting online payment', [], 'ORDER_NOT_AWAITING_PAYMENT');
          }

          cancelledOrderId = order._id;
          return;
        }

        const payment = await Payment.findOne({ order: order._id }).session(session);
        const cancellationNote = note || 'Cancelled by admin';

        order.status = ORDER_STATUSES.CANCELLED;
        order.cancellation = {
          requestedBy: 'admin',
          reason: cancellationNote,
          cancelledAt: new Date(),
          policyCode: policy.code,
        };
        order.statusHistory.push({
          status: ORDER_STATUSES.CANCELLED,
          timestamp: new Date(),
          note: cancellationNote,
          updatedBy: adminId,
        });

        await inventoryReservationService.releaseForOrder(order, session, {
          reason: cancellationNote,
        });

        await loyaltyService.restoreForOrder(order, {
          session,
          eventType: loyaltyService.EVENTS.ORDER_CANCELLED_RESTORE,
          reason: `Points refunded for cancelled order ${order.orderNumber}`,
        });

        await couponUsageService.releaseForOrder(order, session);

        if (order.paymentMethod === 'cod') {
          order.paymentStatus = 'failed';
          if (payment) {
            payment.status = PAYMENT_STATUSES.FAILED;
            payment.webhookEvents.push({
              event: 'admin.cancel_cod_order',
              payload: { adminId },
              receivedAt: new Date(),
            });
            await payment.save({ session });
          }
        } else if (policy.refundRequired) {
          await refundService.requestForOrder({
            order,
            payment,
            amount: policy.refundAmount,
            reason: cancellationNote,
            requestedBy: 'admin',
            requestedByUser: adminId,
            session,
          });
        }

        await order.save({ session });
        cancelledOrderId = order._id;
      });

      cache.del('admin:dashboard');
      const cancelledOrder = await Order.findById(cancelledOrderId);

      setImmediate(async () => {
        try {
          const notificationService = require('../notifications/notification.service');
          await notificationService.sendStatusUpdate(cancelledOrder, 'cancelled');
        } catch (err) {
          logger.warn('[Order] Admin cancel notification failed:', err.message);
        }
      });

      return cancelledOrder;
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin: Update order status
   */
  async updateOrderStatus(orderId, status, note, adminId) {
    const initialOrder = await Order.findById(orderId);
    if (!initialOrder) throw ApiError.notFound('Order not found', [], 'ORDER_NOT_FOUND');

    if (status === ORDER_STATUSES.CANCELLED) {
      return this.cancelOrderByAdmin(orderId, note, adminId);
    }

    if (!canMoveOnlineOrderToStatus(initialOrder, status)) {
      throw ApiError.badRequest('Unpaid online orders can only be cancelled', [], 'UNPAID_ONLINE_ORDER_NOT_UPDATABLE');
    }

    if (initialOrder.paymentMethod === 'online' && initialOrder.paymentStatus !== 'paid' && status === ORDER_STATUSES.CANCELLED) {
      const session = await mongoose.startSession();
      let cancelledOrderId = null;

      try {
        await session.withTransaction(async () => {
          const sessionOrder = await Order.findById(orderId).session(session);
          if (!sessionOrder) throw ApiError.notFound('Order not found', [], 'ORDER_NOT_FOUND');

          const result = await cancelUnpaidOnlineOrder(sessionOrder, {
            session,
            paymentStatus: 'failed',
            paymentRecordStatus: PAYMENT_STATUSES.FAILED,
            note: note || 'Cancelled by admin before payment completion',
            paymentEvent: 'admin.cancel_unpaid_online_order',
            paymentPayload: { adminId },
          });

          if (!result.changed) {
            throw ApiError.badRequest('Order is no longer awaiting online payment', [], 'ORDER_NOT_AWAITING_PAYMENT');
          }

          cancelledOrderId = sessionOrder._id;
        });
      } finally {
        session.endSession();
      }

      return Order.findById(cancelledOrderId);
    }

    const session = await mongoose.startSession();
    let updatedOrderId = null;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw ApiError.notFound('Order not found', [], 'ORDER_NOT_FOUND');

        if (!canMoveOnlineOrderToStatus(order, status)) {
          throw ApiError.badRequest('Unpaid online orders can only be cancelled', [], 'UNPAID_ONLINE_ORDER_NOT_UPDATABLE');
        }

        order.status = status;
        order.statusHistory.push({
          status,
          timestamp: new Date(),
          note: note || `Status changed to ${status}`,
          updatedBy: adminId,
        });

        if (status === ORDER_STATUSES.DELIVERED && order.user) {
          await loyaltyService.earnForDeliveredOrder(order, { session });
        }

        await order.save({ session });
        updatedOrderId = order._id;
      });
    } finally {
      session.endSession();
    }

    cache.del('admin:dashboard');
    return Order.findById(updatedOrderId);
  }

  /**
   * Admin: Get all orders with filters
   */
  async adminGetOrders(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.city) filter.deliveryCity = query.city;
    if (query.orderNumber) filter.orderNumber = { $regex: escapeRegex(query.orderNumber), $options: 'i' };
    if (query.from && query.to) {
      filter.createdAt = { $gte: new Date(query.from), $lte: new Date(query.to) };
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);

    return paginatedResponse(orders, total, page, limit);
  }
}

module.exports = new OrderService();
