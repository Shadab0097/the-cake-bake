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
const ApiError = require('../../utils/ApiError');
const { generateOrderNumber, escapeRegex } = require('../../utils/helpers');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../../utils/constants');
const { getRazorpayInstance } = require('../../config/razorpay');

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
    const { addressId, deliveryDate, shippingAddress, specialInstructions, isGift, giftMessage, paymentMethod = 'cod' } = checkoutData;

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

    const total = subtotal + deliveryCharge - discount;
    if (total <= 0) throw ApiError.badRequest('Invalid order total');

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order
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

      // Clear ordered items from cart
      if (cart && cart.items.length > 0 && orderItems.length > 0) {
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

      // ── COD: no Razorpay needed ──────────────────────────────────────────────
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
          name: process.env.APP_NAME || 'Cake Bake',
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
      // Log the actual error for debugging
      console.error('Order creation failed:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Failed to create order. Please try again.');
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
   * Cancel order (user-initiated)
   */
  async cancelOrder(userId, orderNumber) {
    const order = await Order.findOne({ orderNumber, user: userId });
    if (!order) throw ApiError.notFound('Order not found');

    const cancellableStatuses = [ORDER_STATUSES.PENDING, ORDER_STATUSES.CONFIRMED];
    if (!cancellableStatuses.includes(order.status)) {
      throw ApiError.badRequest('Order cannot be cancelled at this stage');
    }

    order.status = ORDER_STATUSES.CANCELLED;
    order.statusHistory.push({
      status: ORDER_STATUSES.CANCELLED,
      timestamp: new Date(),
      note: 'Cancelled by customer',
    });
    await order.save();

    // Restore stock — target specific variant by product AND weight
    for (const item of order.items) {
      if (item.product) {
        await Variant.updateOne(
          { product: item.product, weight: item.weight },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    return order;
  }

  /**
   * Admin: Update order status
   */
  async updateOrderStatus(orderId, status, note, adminId) {
    const order = await Order.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found');

    order.status = status;
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status changed to ${status}`,
      updatedBy: adminId,
    });

    if (status === ORDER_STATUSES.DELIVERED) {
      // Award loyalty points: 1 point per ₹100 spent
      try {
        const LoyaltyPoints = require('../../models/LoyaltyPoints');
        const { USER_ROLES } = require('../../utils/constants');
        const User = require('../../models/User');
        const pointsEarned = Math.floor(order.total / 10000); // paise → rupees → /100
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
      } catch (lpErr) {
        const logger = require('../../middleware/logger');
        logger.warn('Loyalty points update failed:', lpErr.message);
      }
    }

    await order.save();
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
