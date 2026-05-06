const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Cart = require('../../models/Cart');
const Variant = require('../../models/Variant');
const Product = require('../../models/Product');
const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
const DeliveryZone = require('../../models/DeliveryZone');
const Address = require('../../models/Address');
const User = require('../../models/User');
const LoyaltyPoints = require('../../models/LoyaltyPoints');
const ApiError = require('../../utils/ApiError');
const { generateOrderNumber, escapeRegex } = require('../../utils/helpers');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const { getRazorpayInstance } = require('../../config/razorpay');
const { env } = require('../../config/env');
const logger = require('../../middleware/logger');
const cache = require('../../utils/cache');
const { canMoveOnlineOrderToStatus, cancelUnpaidOnlineOrder } = require('./order.lifecycle');

class OrderService {
  /**
   * Resolve address: either from DB (addressId) or inline (shippingAddress)
   * Optionally saves inline address to DB if userId provided
   */
  async resolveAddress(userId, addressId, shippingAddress) {
    if (addressId) {
      const address = await Address.findOne({ _id: addressId, user: userId });
      if (!address) throw ApiError.badRequest('Invalid delivery address');
      return address;
    }

    if (shippingAddress) {
      const address = new Address({
        user: userId,
        ...shippingAddress,
      });
      await address.save();
      return address;
    }

    throw ApiError.badRequest('Delivery address is required');
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
      throw ApiError.badRequest('Cart is empty');
    }

    // Validate all items are still available
    for (const item of cart.items) {
      if (!item.product?.isActive) {
        throw ApiError.badRequest(`Product "${item.snapshotName}" is no longer available`);
      }
      if (!item.variant?.isActive) {
        throw ApiError.badRequest(`Variant for "${item.snapshotName}" is no longer available`);
      }
      if (item.variant.stock < item.quantity) {
        throw ApiError.badRequest(`Insufficient stock for "${item.snapshotName}"`);
      }
    }

    // Validate address
    const address = await this.resolveAddress(userId, addressId, shippingAddress);

    // Check delivery zone
    const zone = await DeliveryZone.findOne({
      city: { $regex: new RegExp(`^${address.city}$`, 'i') },
      isActive: true,
    });

    if (!zone) {
      throw ApiError.badRequest(`Delivery not available in ${address.city}`);
    }

    if (zone.pincodes.length > 0 && !zone.pincodes.includes(address.pincode)) {
      throw ApiError.badRequest(`Delivery not available for pincode ${address.pincode}`);
    }

    return { cart, address, zone };
  }

  /**
   * Create order and Razorpay payment order
   */
  async createOrder(userId, checkoutData) {
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

    // ── Loyalty Points Redemption ──────────────────────────────────────────
    let pointsRedeemed = 0;
    let pointsDiscount = 0;

    if (redeemPoints && userId) {
      const loyaltyConfig = env.loyalty;
      const user = await User.findById(userId).select('loyaltyPoints');
      const userBalance = user?.loyaltyPoints || 0;

      if (userBalance >= loyaltyConfig.minRedeem) {
        // Max discount from points = maxRedeemPercent% of (subtotal + deliveryCharge - couponDiscount)
        const prePointsTotal = subtotal + deliveryCharge - discount;
        const maxPointsDiscount = Math.floor(prePointsTotal * loyaltyConfig.maxRedeemPercent / 100);
        // Max points the user can redeem (capped by balance and discount ceiling)
        const maxRedeemablePoints = Math.floor(maxPointsDiscount / loyaltyConfig.pointValue);
        pointsRedeemed = Math.min(userBalance, maxRedeemablePoints);
        pointsDiscount = pointsRedeemed * loyaltyConfig.pointValue; // paise
      }
    }

    const total = subtotal + deliveryCharge - discount - pointsDiscount;
    if (total <= 0) throw ApiError.badRequest('Invalid order total');

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order using transaction session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.create([{
        orderNumber,
        user: userId,
        items: orderItems,
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          landmark: address.landmark,
        },
        deliveryDate: new Date(deliveryDate),
        deliverySlot: deliverySlot || {},
        deliveryCity: address.city,
        subtotal,
        deliveryCharge,
        discount,
        couponCode,
        pointsRedeemed,
        pointsDiscount,
        tax: 0,
        total,
        status: ORDER_STATUSES.PENDING,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: 'pending',
        statusHistory: [{ status: ORDER_STATUSES.PENDING, timestamp: new Date(), note: 'Order created' }],
        specialInstructions: specialInstructions || '',
        isGift: isGift || false,
        giftMessage: giftMessage || '',
      }], { session });

      const createdOrder = order[0];

      // ── Deduct loyalty points (inside transaction for atomicity) ──────────
      if (pointsRedeemed > 0 && userId) {
        await User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: -pointsRedeemed } }, { session });
        await LoyaltyPoints.create([{
          user: userId,
          type: 'redeemed',
          points: -pointsRedeemed,
          source: 'order',
          referenceId: createdOrder._id,
          description: `Redeemed ${pointsRedeemed} points for order ${orderNumber}`,
        }], { session });
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

        // FIX: Decrement stock for COD orders (was missing — caused overselling)
        await this.decrementStockSession(orderItems, session, createdOrder.orderNumber);

        // FIX: Record coupon usage for COD orders (was missing — allowed unlimited reuse)
        if (couponCode) {
          await this.recordCouponUsageSession(couponCode, userId, createdOrder._id, session);
        }

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
            name: address.fullName,
            contact: address.phone,
          },
        },
      };
    } catch (error) {
      await session.abortTransaction();
      // FIX: Use logger instead of console.error so errors appear in log files
      logger.error('Order creation failed:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create order. Please try again.');
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
    const coupon = await Coupon.findOne({ code: couponCode });
    if (coupon) {
      await CouponUsage.create([{
        coupon: coupon._id,
        user: userId,
        order: orderId,
      }], { session });
      await Coupon.findByIdAndUpdate(
        coupon._id,
        { $inc: { usageCount: 1 } },
        { session }
      );
    }
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

    if (!order) throw ApiError.notFound('Order not found');
    return order;
  }

  /**
   * Cancel order (user-initiated) — fully transactional
   */
  async cancelOrder(userId, orderNumber) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findOne({ orderNumber, user: userId }).session(session);
      if (!order) throw ApiError.notFound('Order not found');

      const cancellableStatuses = [ORDER_STATUSES.PENDING, ORDER_STATUSES.CONFIRMED];
      if (!cancellableStatuses.includes(order.status)) {
        throw ApiError.badRequest('Order cannot be cancelled at this stage');
      }

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
          throw ApiError.badRequest('Order is no longer awaiting online payment');
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

      order.status = ORDER_STATUSES.CANCELLED;
      order.statusHistory.push({
        status: ORDER_STATUSES.CANCELLED,
        timestamp: new Date(),
        note: 'Cancelled by customer',
      });
      await order.save({ session });

      // ── Refund redeemed loyalty points (inside transaction) ──────────────
      if (order.pointsRedeemed > 0 && order.user) {
        await User.findByIdAndUpdate(
          order.user,
          { $inc: { loyaltyPoints: order.pointsRedeemed } },
          { session }
        );
        await LoyaltyPoints.create([{
          user: order.user,
          type: 'adjusted',
          points: order.pointsRedeemed,
          source: 'order',
          referenceId: order._id,
          description: `Points refunded for cancelled order ${order.orderNumber}`,
        }], { session });
      }

      // ── FIX: Bulk stock restore (was N+1 sequential queries) ─────────────
      const bulkOps = order.items
        .filter((item) => item.product)
        .map((item) => ({
          updateOne: {
            filter: { product: item.product, weight: item.weight },
            update: { $inc: { stock: item.quantity } },
          },
        }));

      if (bulkOps.length > 0) {
        await Variant.bulkWrite(bulkOps, { session });
      }

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
      throw ApiError.internal('Failed to cancel order. Please try again.');
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin: Update order status
   */
  async updateOrderStatus(orderId, status, note, adminId) {
    const order = await Order.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found');

    if (!canMoveOnlineOrderToStatus(order, status)) {
      throw ApiError.badRequest('Unpaid online orders can only be cancelled');
    }

    if (order.paymentMethod === 'online' && order.paymentStatus !== 'paid' && status === ORDER_STATUSES.CANCELLED) {
      const session = await mongoose.startSession();
      let cancelledOrderId = null;

      try {
        await session.withTransaction(async () => {
          const sessionOrder = await Order.findById(orderId).session(session);
          if (!sessionOrder) throw ApiError.notFound('Order not found');

          const result = await cancelUnpaidOnlineOrder(sessionOrder, {
            session,
            paymentStatus: 'failed',
            paymentRecordStatus: PAYMENT_STATUSES.FAILED,
            note: note || 'Cancelled by admin before payment completion',
            paymentEvent: 'admin.cancel_unpaid_online_order',
            paymentPayload: { adminId },
          });

          if (!result.changed) {
            throw ApiError.badRequest('Order is no longer awaiting online payment');
          }

          cancelledOrderId = sessionOrder._id;
        });
      } finally {
        session.endSession();
      }

      return Order.findById(cancelledOrderId);
    }

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status changed to ${status}`,
      updatedBy: adminId,
    });

    if (status === ORDER_STATUSES.DELIVERED && order.user) {
      // Award loyalty points — uses env config, with idempotency guard
      try {
        // Idempotency: skip if points were already awarded for this order
        const existingAward = await LoyaltyPoints.findOne({ referenceId: order._id, type: 'earned' });
        if (!existingAward) {
          const totalInRupees = order.total / 100; // paise → rupees
          const pointsEarned = Math.floor(totalInRupees * env.loyalty.pointsPerRupee);
          if (pointsEarned > 0) {
            await LoyaltyPoints.create({
              user: order.user,
              type: 'earned',
              points: pointsEarned,
              source: 'order',
              referenceId: order._id,
              description: `Points earned for order ${order.orderNumber}`,
            });
            await User.findByIdAndUpdate(order.user, { $inc: { loyaltyPoints: pointsEarned } });
          }
        }
      } catch (lpErr) {
        logger.warn('Loyalty points award failed:', lpErr.message);
      }
    }

    await order.save();
    cache.del('admin:dashboard');
    return order;
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
