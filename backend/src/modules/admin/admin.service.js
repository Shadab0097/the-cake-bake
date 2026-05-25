const mongoose = require('mongoose');
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Payment = require('../../models/Payment');
const Cart = require('../../models/Cart');
const Coupon = require('../../models/Coupon');
const InventoryReservation = require('../../models/InventoryReservation');
const NotificationLog = require('../../models/NotificationLog');
const OperationalAlert = require('../../models/OperationalAlert');
const Refund = require('../../models/Refund');
const Variant = require('../../models/Variant');
const { startOfDay, endOfDay, escapeRegex } = require('../../utils/helpers');
const { ORDER_STATUSES, PAYMENT_STATUSES, REFUND_STATUSES } = require('../../utils/constants');
const cache = require('../../utils/cache');
const loyaltyService = require('../loyalty/loyalty.service');

const LOW_STOCK_THRESHOLD = 10;
const OPERATION_WINDOW_HOURS = 24;
const ABANDONED_CART_HOURS = 2;

const countMap = (rows = [], keys = []) => {
  const output = keys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    if (!row?._id) return;
    output[row._id] = row.count || 0;
  });

  return output;
};

class AdminService {
  /**
   * Dashboard overview — sales stats, order counts, revenue
   */
  async getDashboard(query = {}) {
    // Cache dashboard for 60 seconds to prevent DB overload from rapid refreshes
    return cache.getOrSet('admin:dashboard', async () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const windowStart = new Date(now.getTime() - (OPERATION_WINDOW_HOURS * 60 * 60 * 1000));
    const abandonedCartCutoff = new Date(now.getTime() - (ABANDONED_CART_HOURS * 60 * 60 * 1000));

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const actionableOrderFilter = {
      status: { $in: [ORDER_STATUSES.PENDING, ORDER_STATUSES.CONFIRMED] },
      $or: [
        { paymentMethod: 'cod' },
        { paymentMethod: 'online', paymentStatus: 'paid' },
      ],
    };
    const dashboardOrderFilter = {
      $or: [
        { paymentMethod: 'cod' },
        { paymentStatus: 'paid' },
      ],
    };
    const activeOrderStatuses = [
      ORDER_STATUSES.PENDING,
      ORDER_STATUSES.CONFIRMED,
      ORDER_STATUSES.PREPARING,
      ORDER_STATUSES.PACKED,
      ORDER_STATUSES.DISPATCHED,
      ORDER_STATUSES.OUT_FOR_DELIVERY,
    ];

    const [
      totalOrders,
      todayOrders,
      monthOrders,
      totalRevenue,
      todayRevenue,
      monthRevenue,
      totalCustomers,
      totalProducts,
      pendingOrders,
      recentOrders,
      statusDistribution,
      todayStatusDistribution,
      paymentStatusDistribution,
      stalePendingPayments,
      lowStockVariants,
      lowStockVariantCount,
      refundStatusDistribution,
      refundQueue,
      openAlertDistribution,
      recentAlerts,
      failedNotifications,
      recentFailedNotifications,
      highRiskCodOrders,
      activeReservations,
      expiringReservations,
      abandonedCarts,
      topCoupons,
    ] = await Promise.all([
      Order.countDocuments({ paymentStatus: 'paid' }),
      Order.countDocuments({ paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Order.countDocuments({ paymentStatus: 'paid', createdAt: { $gte: monthStart, $lte: monthEnd } }),

      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { paymentStatus: 'paid', createdAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),

      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(actionableOrderFilter),

      // Recent dashboard orders exclude failed/expired online attempts; those remain filterable in Orders.
      Order.find(dashboardOrderFilter)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber user guestInfo items shippingAddress total status paymentStatus paymentMethod source sourceInquiryType sourceInquiry sourceQuote deliveryDate deliverySlot createdAt')
        .lean(),

      Order.aggregate([
        { $match: dashboardOrderFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...dashboardOrderFilter, createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: windowStart } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Payment.countDocuments({
        status: { $in: [PAYMENT_STATUSES.CREATED, PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.AUTHORIZED] },
        createdAt: { $lte: new Date(now.getTime() - (30 * 60 * 1000)) },
      }),
      Variant.find({ isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } })
        .populate('product', 'name slug isActive')
        .sort({ stock: 1, updatedAt: -1 })
        .limit(20)
        .lean(),
      Variant.countDocuments({ isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } }),
      Refund.aggregate([
        { $match: { status: { $ne: REFUND_STATUSES.REFUNDED } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Refund.find({ status: { $in: [REFUND_STATUSES.REQUESTED, REFUND_STATUSES.APPROVED, REFUND_STATUSES.PROCESSING, REFUND_STATUSES.FAILED] } })
        .populate('order', 'orderNumber')
        .sort({ createdAt: 1 })
        .limit(8)
        .select('order amount status reason requestedBy createdAt failureReason')
        .lean(),
      OperationalAlert.aggregate([
        { $match: { status: 'open' } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      OperationalAlert.find({ status: 'open' })
        .sort({ severity: 1, lastSeenAt: -1 })
        .limit(8)
        .select('type severity source message occurrenceCount lastSeenAt')
        .lean(),
      NotificationLog.countDocuments({ status: 'failed', createdAt: { $gte: windowStart } }),
      NotificationLog.find({ status: 'failed', createdAt: { $gte: windowStart } })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('channel type recipient errorMessage createdAt')
        .lean(),
      Order.find({
        paymentMethod: 'cod',
        'codRisk.decision': 'review',
        status: { $in: activeOrderStatuses },
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('orderNumber guestInfo user total status codRisk createdAt')
        .populate('user', 'name email phone')
        .lean(),
      InventoryReservation.countDocuments({ status: 'reserved' }),
      InventoryReservation.countDocuments({
        status: 'reserved',
        expiresAt: { $lte: new Date(now.getTime() + (15 * 60 * 1000)) },
      }),
      Cart.countDocuments({
        'items.0': { $exists: true },
        updatedAt: { $lte: abandonedCartCutoff },
      }),
      Coupon.find({ isActive: true })
        .sort({ usageCount: -1, updatedAt: -1 })
        .limit(8)
        .select('code usageCount usageLimit validUntil')
        .lean(),
    ]);

    const paymentStatusCounts = countMap(paymentStatusDistribution, Object.values(PAYMENT_STATUSES));
    const refundStatusCounts = countMap(refundStatusDistribution, Object.values(REFUND_STATUSES));
    const openAlertCounts = countMap(openAlertDistribution, ['critical', 'warning', 'info']);
    const filteredLowStock = lowStockVariants
      .filter((variant) => variant.product?.isActive !== false)
      .slice(0, 8)
      .map((variant) => ({
        _id: variant._id,
        product: variant.product,
        weight: variant.weight,
        sku: variant.sku,
        stock: variant.stock,
        updatedAt: variant.updatedAt,
      }));

    return {
      overview: {
        totalOrders,
        todayOrders,
        monthOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        monthRevenue: monthRevenue[0]?.total || 0,
        totalCustomers,
        totalProducts,
        pendingOrders,
      },
      recentOrders,
      statusDistribution: statusDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      operations: {
        windowHours: OPERATION_WINDOW_HOURS,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        todayOrdersByStatus: countMap(todayStatusDistribution, Object.values(ORDER_STATUSES)),
        payments: {
          pending: (
            paymentStatusCounts[PAYMENT_STATUSES.CREATED] +
            paymentStatusCounts[PAYMENT_STATUSES.PENDING] +
            paymentStatusCounts[PAYMENT_STATUSES.AUTHORIZED]
          ),
          failed: paymentStatusCounts[PAYMENT_STATUSES.FAILED],
          expired: paymentStatusCounts[PAYMENT_STATUSES.EXPIRED],
          stalePending: stalePendingPayments,
        },
        refunds: {
          requested: refundStatusCounts[REFUND_STATUSES.REQUESTED],
          approved: refundStatusCounts[REFUND_STATUSES.APPROVED],
          processing: refundStatusCounts[REFUND_STATUSES.PROCESSING],
          failed: refundStatusCounts[REFUND_STATUSES.FAILED],
          queue: refundQueue,
        },
        alerts: {
          critical: openAlertCounts.critical,
          warning: openAlertCounts.warning,
          info: openAlertCounts.info,
          recent: recentAlerts,
        },
        inventory: {
          lowStockCount: lowStockVariantCount,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
          lowStock: filteredLowStock,
          activeReservations,
          expiringReservations,
        },
        notifications: {
          failed: failedNotifications,
          recentFailed: recentFailedNotifications,
        },
        cod: {
          highRiskCount: highRiskCodOrders.length,
          highRiskOrders: highRiskCodOrders,
        },
        carts: {
          abandoned: abandonedCarts,
          abandonedAfterHours: ABANDONED_CART_HOURS,
        },
        coupons: {
          top: topCoupons,
          nearLimit: topCoupons.filter((coupon) => (
            coupon.usageLimit > 0 &&
            (coupon.usageCount / coupon.usageLimit) >= 0.8
          )),
        },
      },
    };
    }, 60); // 60 second TTL
  }

  /**
   * Analytics — revenue by day for last N days
   */
  async getAnalytics(query) {
    const days = parseInt(query.days, 10) || 30;
    const cacheKey = `admin:analytics:${days}`;

    return cache.getOrSet(cacheKey, async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const revenueByDay = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topProducts = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    const topCities = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$deliveryCity',
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    return { revenueByDay, topProducts, topCities };
    }, 300); // 5 minute TTL
  }

  /**
   * List customers with order stats
   */
  async getCustomers(query) {
    const { parsePagination, paginatedResponse } = require('../../utils/pagination');
    const { page, limit, skip } = parsePagination(query);

    const filter = { role: 'customer' };
    if (query.search) {
      const safeSearch = escapeRegex(query.search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [customers, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(customers, total, page, limit);
  }

  /**
   * Get customer detail with their orders
   */
  async getCustomerDetail(customerId) {
    const [customer, orders] = await Promise.all([
      User.findById(customerId).lean(),
      Order.find({ user: customerId }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    if (!customer) {
      const ApiError = require('../../utils/ApiError');
      throw ApiError.notFound('Customer not found');
    }

    return { customer, orders };
  }

  /**
   * Manual loyalty-points adjustment by admin
   * @param {string} customerId - user ID
   * @param {number} points - positive = add, negative = deduct
   * @param {string} reason - admin-provided reason
   * @param {string} adminId - who performed the action
   */
  async adjustCustomerPoints(customerId, points, reason, adminId) {
    const ApiError = require('../../utils/ApiError');
    const session = await mongoose.startSession();
    let result = null;

    try {
      await session.withTransaction(async () => {
        const customer = await User.findById(customerId).select('_id').session(session);
        if (!customer) throw ApiError.notFound('Customer not found');

        result = await loyaltyService.adjustBalance({
          userId: customerId,
          points,
          source: 'admin',
          referenceId: adminId,
          description: reason,
          session,
        });
      });
    } finally {
      session.endSession();
    }

    return result;
  }
}

module.exports = new AdminService();
module.exports.AdminService = AdminService;
module.exports.countMap = countMap;
