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
// Razorpay standard pricing: 2% transaction fee + 18% GST on that fee ≈ 2.36%.
// Charged on online payments only — COD has no gateway fee.
const GATEWAY_FEE_RATE = 0.0236;

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
   * Sales analytics with date-range, city, and product filters.
   * Powers the dedicated Sales page. Counts only paid orders — COD is
   * included once delivered (see order.service.updateOrderStatus).
   *
   * When a product filter is set, every metric switches to that product's
   * line items (price x qty, units sold, distinct orders). Otherwise metrics
   * are order-level (revenue = order total).
   */
  async getSalesAnalytics(query = {}) {
    const ApiError = require('../../utils/ApiError');
    const city = (query.city || '').trim();
    const product = (query.product || '').trim();
    const productId = product && mongoose.Types.ObjectId.isValid(product)
      ? new mongoose.Types.ObjectId(product)
      : null;

    // Resolve the active window: explicit from/to wins, else last N days.
    let startDate;
    let endDate;
    if (query.from && query.to) {
      startDate = startOfDay(new Date(query.from));
      endDate = endOfDay(new Date(query.to));
    } else {
      const days = Math.min(Math.max(parseInt(query.days, 10) || 30, 1), 366);
      endDate = endOfDay(new Date());
      startDate = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw ApiError.badRequest('Invalid date range');
    }

    // Preceding window of equal length, for period-over-period deltas.
    const rangeMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(startDate.getTime() - rangeMs - 1);

    const cacheKey = `admin:sales:${startDate.toISOString()}:${endDate.toISOString()}:${city}:${product}`;

    return cache.getOrSet(cacheKey, async () => {
      const matchFor = (start, end) => {
        const match = { paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } };
        if (city) match.deliveryCity = city;
        return match;
      };
      const lineRevenue = { $multiply: ['$items.price', '$items.quantity'] };

      // Summary metrics (revenue / orders / units) for a given window.
      const summaryPipeline = (start, end) => (productId
        ? [
          { $match: matchFor(start, end) },
          { $unwind: '$items' },
          { $match: { 'items.product': productId } },
          { $group: { _id: null, revenue: { $sum: lineRevenue }, units: { $sum: '$items.quantity' }, orders: { $addToSet: '$_id' } } },
          { $project: { _id: 0, revenue: 1, units: 1, orders: { $size: '$orders' } } },
        ]
        : [
          { $match: matchFor(start, end) },
          { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 }, units: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } },
          { $project: { _id: 0, revenue: 1, orders: 1, units: 1 } },
        ]);

      // Revenue grouped by calendar day.
      const revenueByDayPipeline = productId
        ? [
          { $match: matchFor(startDate, endDate) },
          { $unwind: '$items' },
          { $match: { 'items.product': productId } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: lineRevenue }, orders: { $addToSet: '$_id' } } },
          { $project: { revenue: 1, orders: { $size: '$orders' } } },
          { $sort: { _id: 1 } },
        ]
        : [
          { $match: matchFor(startDate, endDate) },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ];

      // Top products by revenue (always line-item based).
      const topProductsPipeline = [
        { $match: matchFor(startDate, endDate) },
        { $unwind: '$items' },
        ...(productId ? [{ $match: { 'items.product': productId } }] : []),
        { $group: { _id: '$items.product', name: { $first: '$items.name' }, revenue: { $sum: lineRevenue }, units: { $sum: '$items.quantity' }, orders: { $addToSet: '$_id' } } },
        { $project: { name: 1, revenue: 1, units: 1, orders: { $size: '$orders' } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ];

      // Top cities by revenue.
      const topCitiesPipeline = productId
        ? [
          { $match: matchFor(startDate, endDate) },
          { $unwind: '$items' },
          { $match: { 'items.product': productId } },
          { $group: { _id: '$deliveryCity', revenue: { $sum: lineRevenue }, orders: { $addToSet: '$_id' } } },
          { $project: { revenue: 1, orders: { $size: '$orders' } } },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ]
        : [
          { $match: matchFor(startDate, endDate) },
          { $group: { _id: '$deliveryCity', revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
          { $sort: { revenue: -1 } },
          { $limit: 10 },
        ];

      // Top add-ons by revenue (line-item add-on snapshots: price x item quantity).
      const topAddonsPipeline = [
        { $match: matchFor(startDate, endDate) },
        { $unwind: '$items' },
        ...(productId ? [{ $match: { 'items.product': productId } }] : []),
        { $unwind: '$items.addOns' },
        {
          $group: {
            _id: '$items.addOns.name',
            revenue: { $sum: { $multiply: ['$items.addOns.price', '$items.quantity'] } },
            units: { $sum: '$items.quantity' },
            orders: { $addToSet: '$_id' },
          },
        },
        { $project: { revenue: 1, units: 1, orders: { $size: '$orders' } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ];

      const [curAgg, prevAgg, revenueByDay, topProducts, topCities, topAddons] = await Promise.all([
        Order.aggregate(summaryPipeline(startDate, endDate)),
        Order.aggregate(summaryPipeline(prevStart, prevEnd)),
        Order.aggregate(revenueByDayPipeline),
        Order.aggregate(topProductsPipeline),
        Order.aggregate(topCitiesPipeline),
        Order.aggregate(topAddonsPipeline),
      ]);

      const toSummary = (agg) => {
        const row = agg[0] || {};
        const revenue = row.revenue || 0;
        const orders = row.orders || 0;
        return { revenue, orders, units: row.units || 0, aov: orders > 0 ? Math.round(revenue / orders) : 0 };
      };
      const summary = toSummary(curAgg);
      const previous = toSummary(prevAgg);
      const pctChange = (current, prior) => (prior > 0 ? Math.round(((current - prior) / prior) * 100) : null);

      return {
        range: { from: startDate, to: endDate, city, product },
        summary,
        previous,
        deltas: {
          revenue: pctChange(summary.revenue, previous.revenue),
          orders: pctChange(summary.orders, previous.orders),
          units: pctChange(summary.units, previous.units),
          aov: pctChange(summary.aov, previous.aov),
        },
        revenueByDay,
        topProducts,
        topCities,
        topAddons,
      };
    }, 120); // 2 minute TTL
  }

  /**
   * Profit & Loss analytics with date-range and city filters.
   *
   * Model (per paid order): money customers pay (subtotal − discounts +
   * delivery + tax) minus the real costs. Delivery and GST are treated as
   * pass-through (collected then remitted / spent), so they cancel out and
   * net profit reduces to:
   *
   *   Net profit = gross sales − COGS − discounts − gateway fees
   *
   * COGS uses the cost snapshotted onto each order item at checkout, so
   * historical numbers stay accurate even if a variant's cost changes later.
   */
  async getProfitAnalytics(query = {}) {
    const ApiError = require('../../utils/ApiError');
    const city = (query.city || '').trim();

    let startDate;
    let endDate;
    if (query.from && query.to) {
      startDate = startOfDay(new Date(query.from));
      endDate = endOfDay(new Date(query.to));
    } else {
      const days = Math.min(Math.max(parseInt(query.days, 10) || 30, 1), 366);
      endDate = endOfDay(new Date());
      startDate = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw ApiError.badRequest('Invalid date range');
    }

    const rangeMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(startDate.getTime() - rangeMs - 1);

    const cacheKey = `admin:profit:${startDate.toISOString()}:${endDate.toISOString()}:${city}`;

    return cache.getOrSet(cacheKey, async () => {
      const matchFor = (start, end) => {
        const match = { paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } };
        if (city) match.deliveryCity = city;
        return match;
      };

      // $ifNull guards are essential: orders/items created before these fields
      // existed have no `cost`/`pointsDiscount`, and a missing operand makes
      // $multiply/$add return null — which would null the whole $reduce.
      const cogsExpr = { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: [{ $ifNull: ['$$this.cost', 0] }, '$$this.quantity'] }] } } };
      const unitsExpr = { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } };
      const unitsCostedExpr = { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $cond: [{ $gt: [{ $ifNull: ['$$this.cost', 0] }, 0] }, '$$this.quantity', 0] }] } } };
      const discountsExpr = { $add: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$pointsDiscount', 0] }] };
      const gatewayExpr = { $cond: [{ $eq: ['$paymentMethod', 'online'] }, { $multiply: ['$total', GATEWAY_FEE_RATE] }, 0] };

      const summaryPipeline = (start, end) => ([
        { $match: matchFor(start, end) },
        {
          $group: {
            _id: null,
            grossSales: { $sum: '$subtotal' },
            cogs: { $sum: cogsExpr },
            discounts: { $sum: discountsExpr },
            gatewayFees: { $sum: gatewayExpr },
            tax: { $sum: '$tax' },
            deliveryCharge: { $sum: '$deliveryCharge' },
            orders: { $sum: 1 },
            units: { $sum: unitsExpr },
            unitsCosted: { $sum: unitsCostedExpr },
          },
        },
      ]);

      const profitByDayPipeline = [
        { $match: matchFor(startDate, endDate) },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            grossSales: { $sum: '$subtotal' },
            cogs: { $sum: cogsExpr },
            discounts: { $sum: discountsExpr },
            gatewayFees: { $sum: gatewayExpr },
          },
        },
        { $addFields: { profit: { $subtract: ['$grossSales', { $add: ['$cogs', '$discounts', '$gatewayFees'] }] } } },
        { $project: { grossSales: 1, profit: 1 } },
        { $sort: { _id: 1 } },
      ];

      // Gross margin per product (sell − cost). Order-level discounts/fees are
      // not attributable to a single product, so this is product gross margin.
      const topProductsPipeline = [
        { $match: matchFor(startDate, endDate) },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            cost: { $sum: { $multiply: [{ $ifNull: ['$items.cost', 0] }, '$items.quantity'] } },
            units: { $sum: '$items.quantity' },
          },
        },
        { $addFields: { profit: { $subtract: ['$revenue', '$cost'] } } },
        { $addFields: { margin: { $cond: [{ $gt: ['$revenue', 0] }, { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] }, 0] } } },
        { $sort: { profit: -1 } },
        { $limit: 12 },
      ];

      const [curAgg, prevAgg, profitByDay, topProducts] = await Promise.all([
        Order.aggregate(summaryPipeline(startDate, endDate)),
        Order.aggregate(summaryPipeline(prevStart, prevEnd)),
        Order.aggregate(profitByDayPipeline),
        Order.aggregate(topProductsPipeline),
      ]);

      const toSummary = (agg) => {
        const row = agg[0] || {};
        const grossSales = row.grossSales || 0;
        const cogs = row.cogs || 0;
        const discounts = row.discounts || 0;
        const gatewayFees = Math.round(row.gatewayFees || 0);
        const netProfit = grossSales - cogs - discounts - gatewayFees;
        const units = row.units || 0;
        return {
          grossSales,
          cogs,
          discounts,
          gatewayFees,
          tax: row.tax || 0,
          deliveryCharge: row.deliveryCharge || 0,
          orders: row.orders || 0,
          units,
          unitsCosted: row.unitsCosted || 0,
          netProfit,
          margin: grossSales > 0 ? Math.round((netProfit / grossSales) * 10000) / 100 : 0,
          costCoverage: units > 0 ? Math.round(((row.unitsCosted || 0) / units) * 100) : 0,
        };
      };

      const summary = toSummary(curAgg);
      const previous = toSummary(prevAgg);
      const pctChange = (current, prior) => (prior > 0 ? Math.round(((current - prior) / prior) * 100) : null);

      return {
        range: { from: startDate, to: endDate, city },
        gatewayFeeRate: GATEWAY_FEE_RATE,
        summary,
        previous,
        deltas: {
          netProfit: pctChange(summary.netProfit, previous.netProfit),
          grossSales: pctChange(summary.grossSales, previous.grossSales),
          margin: summary.margin - previous.margin,
        },
        profitByDay,
        topProducts,
      };
    }, 120);
  }

  /**
   * Flat list of active variants for the cost-price editor. Joins the product
   * name so admins can find and set each variant's make/buy cost.
   */
  async listVariantsForCosting(query = {}) {
    const filter = { isActive: true };
    const variants = await Variant.find(filter)
      .populate('product', 'name isActive')
      .sort({ updatedAt: -1 })
      .select('product weight price costPrice sku stock')
      .lean();

    const rows = variants.filter((variant) => variant.product?.isActive !== false);

    if (query.search) {
      const term = String(query.search).toLowerCase();
      return rows.filter((variant) => (
        (variant.product?.name || '').toLowerCase().includes(term) ||
        (variant.sku || '').toLowerCase().includes(term)
      ));
    }
    return rows;
  }

  /**
   * Customer analytics — retention, repeat rate, lifetime value, RFM-lite
   * segments, and period acquisition (new vs returning). Based on registered
   * customers with paid orders; guests (no user account) are excluded since
   * they can't be reliably tracked across orders.
   */
  async getCustomerAnalytics(query = {}) {
    const ApiError = require('../../utils/ApiError');

    let startDate;
    let endDate;
    if (query.from && query.to) {
      startDate = startOfDay(new Date(query.from));
      endDate = endOfDay(new Date(query.to));
    } else {
      const days = Math.min(Math.max(parseInt(query.days, 10) || 30, 1), 366);
      endDate = endOfDay(new Date());
      startDate = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw ApiError.badRequest('Invalid date range');
    }

    const cacheKey = `admin:custanalytics:${startDate.toISOString()}:${endDate.toISOString()}`;

    return cache.getOrSet(cacheKey, async () => {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const now = Date.now();

      // All-time rollup per registered customer (paid orders only).
      const perCustomer = await Order.aggregate([
        { $match: { paymentStatus: 'paid', user: { $ne: null } } },
        {
          $group: {
            _id: '$user',
            orders: { $sum: 1 },
            spent: { $sum: '$total' },
            firstOrder: { $min: '$createdAt' },
            lastOrder: { $max: '$createdAt' },
          },
        },
      ]);

      const customersWhoOrdered = perCustomer.length;
      let repeat = 0;
      let totalOrders = 0;
      let totalSpent = 0;
      const segments = { champions: 0, loyal: 0, new: 0, at_risk: 0, lost: 0 };

      perCustomer.forEach((customer) => {
        totalOrders += customer.orders;
        totalSpent += customer.spent;
        if (customer.orders > 1) repeat += 1;

        const recencyDays = (now - new Date(customer.lastOrder).getTime()) / DAY_MS;
        if (recencyDays > 120) segments.lost += 1;
        else if (recencyDays > 60) segments.at_risk += 1;
        else if (customer.orders >= 3) segments.champions += 1;
        else if (customer.orders >= 2) segments.loyal += 1;
        else segments.new += 1;
      });

      // New vs returning within the selected period.
      const activeInPeriod = await Order.aggregate([
        { $match: { paymentStatus: 'paid', user: { $ne: null }, createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$user' } },
      ]);
      const firstOrderByUser = new Map(perCustomer.map((customer) => [String(customer._id), customer.firstOrder]));
      let newCount = 0;
      let returningCount = 0;
      activeInPeriod.forEach((entry) => {
        const firstOverall = firstOrderByUser.get(String(entry._id));
        if (firstOverall && new Date(firstOverall) >= startDate) newCount += 1;
        else returningCount += 1;
      });

      // Top customers by lifetime value.
      const topSorted = [...perCustomer].sort((a, b) => b.spent - a.spent).slice(0, 10);
      const users = await User.find({ _id: { $in: topSorted.map((c) => c._id) } })
        .select('name email phone')
        .lean();
      const userMap = new Map(users.map((user) => [String(user._id), user]));
      const topCustomers = topSorted.map((customer) => {
        const user = userMap.get(String(customer._id)) || {};
        return {
          _id: customer._id,
          name: user.name || 'Customer',
          email: user.email || '',
          phone: user.phone || '',
          orders: customer.orders,
          spent: customer.spent,
          lastOrder: customer.lastOrder,
        };
      });

      const totalCustomers = await User.countDocuments({ role: 'customer' });

      return {
        range: { from: startDate, to: endDate },
        summary: {
          totalCustomers,
          customersWhoOrdered,
          repeatRate: customersWhoOrdered > 0 ? Math.round((repeat / customersWhoOrdered) * 100) : 0,
          avgOrders: customersWhoOrdered > 0 ? Math.round((totalOrders / customersWhoOrdered) * 10) / 10 : 0,
          avgLtv: customersWhoOrdered > 0 ? Math.round(totalSpent / customersWhoOrdered) : 0,
        },
        acquisition: { new: newCount, returning: returningCount },
        segments,
        topCustomers,
      };
    }, 300);
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

  // ── Settings (company / invoice / reports) ──────────────────────────────
  async getSettings() {
    const Settings = require('../../models/Settings');
    let doc = await Settings.findOne({ key: 'global' });
    if (!doc) doc = await Settings.create({ key: 'global' });
    return doc.toObject ? doc.toObject() : doc;
  }

  async getCompany() {
    const settings = await this.getSettings();
    return settings.company || {};
  }

  async updateSettings(payload = {}) {
    const Settings = require('../../models/Settings');
    const update = {};
    if (payload.company && typeof payload.company === 'object') {
      const c = payload.company;
      const allowed = ['name', 'legalName', 'gstin', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'phone', 'email', 'invoicePrefix', 'hsnCode', 'gstRate'];
      allowed.forEach((key) => { if (c[key] !== undefined) update[`company.${key}`] = c[key]; });
    }
    if (payload.reports && typeof payload.reports === 'object') {
      const r = payload.reports;
      if (r.dailyEnabled !== undefined) update['reports.dailyEnabled'] = !!r.dailyEnabled;
      if (Array.isArray(r.recipients)) update['reports.recipients'] = r.recipients.map((x) => String(x).trim()).filter(Boolean);
      if (r.hour !== undefined) update['reports.hour'] = Math.min(Math.max(parseInt(r.hour, 10) || 0, 0), 23);
    }
    const doc = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return doc.toObject();
  }

  // ── Admin user management ───────────────────────────────────────────────
  async listAdminUsers() {
    return User.find({ role: { $in: ['superadmin', 'admin', 'manager', 'staff'] } })
      .select('name email phone role lastLogin createdAt')
      .sort({ createdAt: 1 })
      .lean();
  }

  async setAdminRole(targetId, role, actingUserId) {
    const ApiError = require('../../utils/ApiError');
    const ASSIGNABLE = ['superadmin', 'admin', 'manager', 'staff', 'customer'];
    if (!ASSIGNABLE.includes(role)) throw ApiError.badRequest('Invalid role');
    if (String(targetId) === String(actingUserId)) throw ApiError.badRequest('You cannot change your own role');

    const user = await User.findById(targetId);
    if (!user) throw ApiError.notFound('User not found');

    // Never strip the last super admin — that would lock everyone out of the
    // financial/settings sections.
    if (user.role === 'superadmin' && role !== 'superadmin') {
      const supers = await User.countDocuments({ role: 'superadmin' });
      if (supers <= 1) throw ApiError.badRequest('Cannot demote the only super admin');
    }

    user.role = role;
    await user.save();
    return { _id: user._id, name: user.name, email: user.email, role: user.role };
  }

  // ── GST summary (output tax collected) ──────────────────────────────────
  async getGstReport(query = {}) {
    const ApiError = require('../../utils/ApiError');
    let startDate;
    let endDate;
    if (query.from && query.to) {
      startDate = startOfDay(new Date(query.from));
      endDate = endOfDay(new Date(query.to));
    } else {
      const days = Math.min(Math.max(parseInt(query.days, 10) || 30, 1), 366);
      endDate = endOfDay(new Date());
      startDate = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      throw ApiError.badRequest('Invalid date range');
    }

    const match = { paymentStatus: 'paid', createdAt: { $gte: startDate, $lte: endDate } };
    const taxableExpr = { $subtract: ['$subtotal', { $add: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$pointsDiscount', 0] }] }] };
    const [summary, byDay] = await Promise.all([
      Order.aggregate([
        { $match: match },
        { $group: { _id: null, taxableValue: { $sum: taxableExpr }, tax: { $sum: { $ifNull: ['$tax', 0] } }, total: { $sum: '$total' }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: match },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, taxableValue: { $sum: taxableExpr }, tax: { $sum: { $ifNull: ['$tax', 0] } }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const s = summary[0] || {};
    return {
      range: { from: startDate, to: endDate },
      summary: { taxableValue: s.taxableValue || 0, tax: s.tax || 0, total: s.total || 0, orders: s.orders || 0 },
      byDay,
    };
  }
}

module.exports = new AdminService();
module.exports.AdminService = AdminService;
module.exports.countMap = countMap;
