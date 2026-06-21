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
    const { toObjectIds, orderBranchMatch, withBranch } = require('../../utils/branchScope');
    const branchIds = toObjectIds(query);
    const branchKey = branchIds.map(String).sort().join(',');
    // Cache dashboard for 60 seconds to prevent DB overload from rapid refreshes.
    // Per-branch key so a walled admin never reads the owner's data; the
    // owner/global key stays 'admin:dashboard' (cleared on every order change),
    // branch keys self-expire on the 60s TTL.
    const dashKey = branchKey ? `admin:dashboard:${branchKey}` : 'admin:dashboard';
    return cache.getOrSet(dashKey, async () => {
    const branchMatch = await orderBranchMatch(branchIds.map(String));
    // Branch-scoped filters for non-Order collections that carry their own
    // branch field: refunds (snapshotted branchId) and coupons (branch link;
    // null = chain-wide, so a branch also sees chain-wide coupons).
    const refundBranchFilter = branchIds.length ? { branchId: { $in: branchIds } } : {};
    const couponBranchFilter = branchIds.length ? { $or: [{ branchId: null }, { branchId: { $in: branchIds } }] } : {};
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
      Order.countDocuments(withBranch({ paymentStatus: 'paid' }, branchMatch)),
      Order.countDocuments(withBranch({ paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd } }, branchMatch)),
      Order.countDocuments(withBranch({ paymentStatus: 'paid', createdAt: { $gte: monthStart, $lte: monthEnd } }, branchMatch)),

      Order.aggregate([
        { $match: withBranch({ paymentStatus: 'paid' }, branchMatch) },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: withBranch({ paymentStatus: 'paid', createdAt: { $gte: todayStart, $lte: todayEnd } }, branchMatch) },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: withBranch({ paymentStatus: 'paid', createdAt: { $gte: monthStart, $lte: monthEnd } }, branchMatch) },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),

      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(withBranch(actionableOrderFilter, branchMatch)),

      // Recent dashboard orders exclude failed/expired online attempts; those remain filterable in Orders.
      Order.find(withBranch(dashboardOrderFilter, branchMatch))
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber user guestInfo items shippingAddress total status paymentStatus paymentMethod source sourceInquiryType sourceInquiry sourceQuote deliveryDate deliverySlot createdAt')
        .lean(),

      Order.aggregate([
        { $match: withBranch(dashboardOrderFilter, branchMatch) },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: withBranch({ ...dashboardOrderFilter, createdAt: { $gte: todayStart, $lte: todayEnd } }, branchMatch) },
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
        { $match: { status: { $ne: REFUND_STATUSES.REFUNDED }, ...refundBranchFilter } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Refund.find({ status: { $in: [REFUND_STATUSES.REQUESTED, REFUND_STATUSES.APPROVED, REFUND_STATUSES.PROCESSING, REFUND_STATUSES.FAILED] }, ...refundBranchFilter })
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
      Order.find(withBranch({
        paymentMethod: 'cod',
        'codRisk.decision': 'review',
        status: { $in: activeOrderStatuses },
      }, branchMatch))
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
      Coupon.find({ isActive: true, ...couponBranchFilter })
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
    const { toObjectIds, orderBranchMatch } = require('../../utils/branchScope');
    const days = parseInt(query.days, 10) || 30;
    const branchIds = toObjectIds(query);
    const cacheKey = `admin:analytics:${days}:${branchIds.map(String).sort().join(',')}`;

    return cache.getOrSet(cacheKey, async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const branchMatch = await orderBranchMatch(branchIds.map(String));

    const revenueByDay = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: startDate },
          ...branchMatch,
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
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate }, ...branchMatch } },
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
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate }, ...branchMatch } },
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
    // Optional multi-city filter (a branch spans several zones/cities).
    const cities = Array.isArray(query.cities) ? query.cities.map((c) => String(c).trim()).filter(Boolean) : [];
    // Optional branch filter — authoritative location key (snapshotted on each
    // order). When set alongside cities, also catches legacy orders that have no
    // branchId snapshot but whose deliveryCity belongs to the branch.
    const branchIds = require('../../utils/branchScope').toObjectIds(query);
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

    const cacheKey = `admin:sales:${startDate.toISOString()}:${endDate.toISOString()}:${city}:${cities.join('|')}:${branchIds.map(String).sort().join(',')}:${product}`;

    return cache.getOrSet(cacheKey, async () => {
      // When filtering by branch, also gather its zones' cities so legacy orders
      // (placed before branchId was snapshotted) are still attributed to it.
      let effectiveCities = cities;
      if (branchIds.length && !effectiveCities.length) {
        const DeliveryZone = require('../../models/DeliveryZone');
        const zs = await DeliveryZone.find({ branchId: { $in: branchIds } }).select('city').lean();
        effectiveCities = [...new Set(zs.map((z) => z.city).filter(Boolean))];
      }
      const matchFor = (start, end) => {
        const match = { paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } };
        if (branchIds.length) {
          match.$or = effectiveCities.length
            ? [{ branchId: { $in: branchIds } }, { branchId: null, deliveryCity: { $in: effectiveCities } }]
            : [{ branchId: { $in: branchIds } }];
        } else if (cities.length) match.deliveryCity = { $in: cities };
        else if (city) match.deliveryCity = city;
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
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: lineRevenue }, units: { $sum: '$items.quantity' }, orders: { $addToSet: '$_id' } } },
          { $project: { revenue: 1, units: 1, orders: { $size: '$orders' } } },
          { $sort: { _id: 1 } },
        ]
        : [
          { $match: matchFor(startDate, endDate) },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 }, units: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } } } },
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
    const cities = Array.isArray(query.cities) ? query.cities.map((c) => String(c).trim()).filter(Boolean) : [];
    const branchIds = require('../../utils/branchScope').toObjectIds(query);

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

    const cacheKey = `admin:profit:${startDate.toISOString()}:${endDate.toISOString()}:${city}:${cities.join('|')}:${branchIds.map(String).sort().join(',')}`;

    return cache.getOrSet(cacheKey, async () => {
      let effectiveCities = cities;
      if (branchIds.length && !effectiveCities.length) {
        const DeliveryZone = require('../../models/DeliveryZone');
        const zs = await DeliveryZone.find({ branchId: { $in: branchIds } }).select('city').lean();
        effectiveCities = [...new Set(zs.map((z) => z.city).filter(Boolean))];
      }
      const matchFor = (start, end) => {
        const match = { paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } };
        if (branchIds.length) {
          match.$or = effectiveCities.length
            ? [{ branchId: { $in: branchIds } }, { branchId: null, deliveryCity: { $in: effectiveCities } }]
            : [{ branchId: { $in: branchIds } }];
        } else if (cities.length) match.deliveryCity = { $in: cities };
        else if (city) match.deliveryCity = city;
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
        { $project: { grossSales: 1, profit: 1, cogs: 1 } },
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
   * Per-branch breakdown of revenue, orders, units, and net profit for a date
   * range — the owner's "compare all branches" view (vs. the branch filter which
   * shows one branch at a time). Profit uses the same model as getProfitAnalytics
   * (grossSales − COGS − discounts − gateway fees). A walled caller is limited to
   * their branches; an owner sees every branch plus an "Unassigned" bucket for
   * orders with no branch.
   */
  async getBranchBreakdown(query = {}) {
    const { toObjectIds, orderBranchMatch, withBranch } = require('../../utils/branchScope');
    const branchIds = toObjectIds(query);

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

    const cacheKey = `admin:branch-breakdown:${startDate.toISOString()}:${endDate.toISOString()}:${branchIds.map(String).sort().join(',')}`;

    return cache.getOrSet(cacheKey, async () => {
      const branchMatch = await orderBranchMatch(branchIds.map(String)); // {} for owner
      const match = withBranch({ paymentStatus: 'paid', createdAt: { $gte: startDate, $lte: endDate } }, branchMatch);

      const cogsExpr = { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: [{ $ifNull: ['$$this.cost', 0] }, '$$this.quantity'] }] } } };
      const unitsExpr = { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } };
      const discountsExpr = { $add: [{ $ifNull: ['$discount', 0] }, { $ifNull: ['$pointsDiscount', 0] }] };
      const gatewayExpr = { $cond: [{ $eq: ['$paymentMethod', 'online'] }, { $multiply: ['$total', GATEWAY_FEE_RATE] }, 0] };

      const rows = await Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$branchId',
            revenue: { $sum: '$total' },
            grossSales: { $sum: '$subtotal' },
            cogs: { $sum: cogsExpr },
            discounts: { $sum: discountsExpr },
            gatewayFees: { $sum: gatewayExpr },
            orders: { $sum: 1 },
            units: { $sum: unitsExpr },
          },
        },
        { $lookup: { from: 'branches', localField: '_id', foreignField: '_id', as: 'branch' } },
        { $sort: { revenue: -1 } },
      ]);

      const branches = rows.map((r) => {
        const gatewayFees = Math.round(r.gatewayFees || 0);
        const netProfit = (r.grossSales || 0) - (r.cogs || 0) - (r.discounts || 0) - gatewayFees;
        const branch = r.branch && r.branch[0];
        return {
          branchId: r._id || null,
          branchName: branch?.name || (r._id ? 'Unknown branch' : 'Unassigned'),
          branchCode: branch?.code || '',
          revenue: r.revenue || 0,
          grossSales: r.grossSales || 0,
          orders: r.orders || 0,
          units: r.units || 0,
          netProfit,
          margin: r.grossSales > 0 ? Math.round((netProfit / r.grossSales) * 10000) / 100 : 0,
          aov: r.orders > 0 ? Math.round((r.revenue || 0) / r.orders) : 0,
        };
      });

      const totals = branches.reduce((acc, b) => ({
        revenue: acc.revenue + b.revenue,
        grossSales: acc.grossSales + b.grossSales,
        orders: acc.orders + b.orders,
        units: acc.units + b.units,
        netProfit: acc.netProfit + b.netProfit,
      }), { revenue: 0, grossSales: 0, orders: 0, units: 0, netProfit: 0 });

      return { range: { from: startDate, to: endDate }, branches, totals };
    }, 60);
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
  // Customer accounts are global, but a walled admin only sees customers who
  // have ordered from one of their branches (derived from order history).
  async getCustomers(query, scope = null) {
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

    if (scope) {
      const { withBranch, orderBranchMatch } = require('../../utils/branchScope');
      const match = await orderBranchMatch(scope);
      const userIds = await Order.distinct('user', withBranch({ user: { $ne: null } }, match));
      filter._id = { $in: userIds };
    }

    const [customers, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(customers, total, page, limit);
  }

  /**
   * Get customer detail with their orders. A walled admin sees only the
   * customer's orders fulfilled by their branches, and a customer with no such
   * orders is treated as not found (no cross-branch customer peeking).
   */
  async getCustomerDetail(customerId, scope = null) {
    const ApiError = require('../../utils/ApiError');
    let orderFilter = { user: customerId };
    if (scope) {
      const { withBranch, orderBranchMatch } = require('../../utils/branchScope');
      orderFilter = withBranch(orderFilter, await orderBranchMatch(scope));
    }

    const [customer, orders] = await Promise.all([
      User.findById(customerId).lean(),
      Order.find(orderFilter).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    if (!customer) throw ApiError.notFound('Customer not found');
    if (scope && orders.length === 0) throw ApiError.notFound('Customer not found');

    return { customer, orders };
  }

  /**
   * Manual loyalty-points adjustment by admin
   * @param {string} customerId - user ID
   * @param {number} points - positive = add, negative = deduct
   * @param {string} reason - admin-provided reason
   * @param {string} adminId - who performed the action
   */
  async adjustCustomerPoints(customerId, points, reason, adminId, scope = null) {
    const ApiError = require('../../utils/ApiError');

    // A walled admin may only adjust points for a customer who has ordered from
    // one of their branches.
    if (scope) {
      const { withBranch, orderBranchMatch } = require('../../utils/branchScope');
      const inBranch = await Order.exists(withBranch({ user: customerId }, await orderBranchMatch(scope)));
      if (!inBranch) throw ApiError.notFound('Customer not found');
    }

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
    let commerceChanged = false;
    if (payload.commerce && typeof payload.commerce === 'object') {
      const cm = payload.commerce;
      if (cm.codEnabled !== undefined) { update['commerce.codEnabled'] = !!cm.codEnabled; commerceChanged = true; }
    }
    if (payload.storeLocation && typeof payload.storeLocation === 'object') {
      const sl = payload.storeLocation;
      const textKeys = ['addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'defaultCity'];
      textKeys.forEach((key) => { if (sl[key] !== undefined) update[`storeLocation.${key}`] = String(sl[key]).trim(); });
      ['lat', 'lng'].forEach((key) => {
        if (sl[key] === undefined) return;
        if (sl[key] === null || sl[key] === '') { update[`storeLocation.${key}`] = null; return; }
        const num = Number(sl[key]);
        if (!Number.isNaN(num)) update[`storeLocation.${key}`] = num;
      });
    }
    if (payload.defaultBranchId !== undefined) {
      const v = payload.defaultBranchId;
      if (v === null || v === '') update.defaultBranchId = null;
      else if (mongoose.Types.ObjectId.isValid(v)) update.defaultBranchId = new mongoose.Types.ObjectId(v);
      // invalid values are ignored (no change)
      commerceChanged = true; // defaultBranchId is served via the commerce cache
    }
    const doc = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Bust caches that read commerce settings (checkout COD policy + the
    // per-pincode serviceability response that now carries codAvailable).
    if (commerceChanged) {
      const { bustCommerceConfig } = require('../../utils/commerceSettings');
      const cache = require('../../utils/cache');
      await bustCommerceConfig();
      await cache.invalidatePattern('delivery:');
    }

    return doc.toObject();
  }

  // ── Admin user management ───────────────────────────────────────────────
  async listAdminUsers() {
    return User.find({ role: { $in: ['superadmin', 'admin', 'manager', 'staff', 'branchadmin'] } })
      .select('name email phone role branchIds isActive mustChangePassword lastLogin createdAt')
      .populate('branchIds', 'name code')
      .sort({ createdAt: 1 })
      .lean();
  }

  // Validate a requested branchIds[] for an admin account: every id must be a
  // real Branch, and a 'branchadmin' must be walled to at least one branch
  // (an empty set would make them an unrestricted owner — a privilege leak).
  // Returns a deduped ObjectId[].
  async _validateBranchIds(branchIds, role) {
    const ApiError = require('../../utils/ApiError');
    const Branch = require('../../models/Branch');
    const raw = Array.isArray(branchIds) ? branchIds : [];
    const ids = [...new Set(raw.map(String).filter((s) => mongoose.Types.ObjectId.isValid(s)))];
    if (ids.length) {
      const count = await Branch.countDocuments({ _id: { $in: ids } });
      if (count !== ids.length) throw ApiError.badRequest('One or more selected branches do not exist');
    }
    if (role === 'branchadmin' && !ids.length) {
      throw ApiError.badRequest('A branch admin must be assigned at least one branch');
    }
    return ids.map((s) => new mongoose.Types.ObjectId(s));
  }

  // Super-admin only: create a new admin-tier user. We issue a one-time
  // temporary password (returned to the caller exactly once) and flag the
  // account to change it. This avoids any dependency on email delivery and
  // never stores or logs a plaintext password.
  async createAdminUser({ name, email, phone, role, branchIds } = {}, actingUserId = null) {
    const ApiError = require('../../utils/ApiError');
    const crypto = require('crypto');
    const ASSIGNABLE = ['staff', 'manager', 'admin', 'superadmin', 'branchadmin'];
    if (!ASSIGNABLE.includes(role)) throw ApiError.badRequest('Invalid role for an admin user');

    const resolvedBranchIds = await this._validateBranchIds(branchIds, role);

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      throw ApiError.conflict('A user with this email already exists', [{ field: 'email', code: 'EMAIL_EXISTS', message: 'A user with this email already exists' }], 'EMAIL_EXISTS');
    }

    const normalizedPhone = phone ? String(phone).trim() : '';
    if (normalizedPhone) {
      const phoneExists = await User.findOne({ phone: normalizedPhone });
      if (phoneExists) {
        throw ApiError.conflict('A user with this phone number already exists', [{ field: 'phone', code: 'PHONE_EXISTS', message: 'A user with this phone number already exists' }], 'PHONE_EXISTS');
      }
    }

    // ~12 url-safe chars — comfortably above the 6-char minimum.
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const user = await User.create({
      name: String(name || '').trim(),
      email: normalizedEmail,
      phone: normalizedPhone || undefined,
      passwordHash: tempPassword, // hashed by the User pre-save hook
      role,
      branchIds: resolvedBranchIds,
      isActive: true,
      isVerified: true,
      mustChangePassword: true,
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        branchIds: resolvedBranchIds.map(String),
        isActive: user.isActive,
        mustChangePassword: true,
        createdAt: user.createdAt,
      },
      tempPassword, // surfaced once to the super admin to hand over securely
    };
  }

  // Super-admin only: set which branches an admin account is walled to. Empty
  // set => owner/HQ (sees all branches). Busts the user cache so the new scope
  // takes effect immediately rather than after the 30s auth-cache TTL.
  async setAdminBranches(targetId, branchIds, actingUserId) {
    const ApiError = require('../../utils/ApiError');
    const user = await User.findById(targetId);
    if (!user) throw ApiError.notFound('User not found');
    if (!['superadmin', 'admin', 'manager', 'staff', 'branchadmin'].includes(user.role)) {
      throw ApiError.badRequest('This user is not an admin account');
    }

    const resolved = await this._validateBranchIds(branchIds, user.role);

    // Never wall the last unrestricted super admin — that would remove the only
    // account able to see every branch (and manage cross-branch settings).
    const isCurrentlyUnwalled = !user.branchIds || user.branchIds.length === 0;
    if (user.role === 'superadmin' && isCurrentlyUnwalled && resolved.length) {
      const unwalledSupers = await User.countDocuments({
        role: 'superadmin',
        isActive: { $ne: false },
        $or: [{ branchIds: { $size: 0 } }, { branchIds: { $exists: false } }],
      });
      if (unwalledSupers <= 1) throw ApiError.badRequest('Cannot wall the only unrestricted super admin');
    }

    user.branchIds = resolved;
    await user.save();
    await require('../../middleware/auth').invalidateUserCache(user._id);
    return { _id: user._id, name: user.name, email: user.email, role: user.role, branchIds: resolved.map(String) };
  }

  async setAdminRole(targetId, role, actingUserId) {
    const ApiError = require('../../utils/ApiError');
    const ASSIGNABLE = ['superadmin', 'admin', 'manager', 'staff', 'branchadmin', 'customer'];
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

    // A branch admin must already be walled to a branch, else the role would
    // grant branch-only sections over ALL branches' data. Assign branches first.
    if (role === 'branchadmin' && (!user.branchIds || user.branchIds.length === 0)) {
      throw ApiError.badRequest('Assign at least one branch before making this user a branch admin');
    }

    user.role = role;
    await user.save();
    await require('../../middleware/auth').invalidateUserCache(user._id);
    return { _id: user._id, name: user.name, email: user.email, role: user.role };
  }

  // Super-admin only: enable/disable an admin account. Inactive accounts are
  // blocked at login; we also clear refresh tokens to force an immediate logout.
  async setAdminActive(targetId, isActive, actingUserId) {
    const ApiError = require('../../utils/ApiError');
    if (String(targetId) === String(actingUserId)) throw ApiError.badRequest('You cannot change your own active status');

    const user = await User.findById(targetId);
    if (!user) throw ApiError.notFound('User not found');
    if (!['superadmin', 'admin', 'manager', 'staff', 'branchadmin'].includes(user.role)) {
      throw ApiError.badRequest('This user is not an admin account');
    }

    if (isActive === false && user.role === 'superadmin') {
      const activeSupers = await User.countDocuments({ role: 'superadmin', isActive: { $ne: false } });
      if (activeSupers <= 1) throw ApiError.badRequest('Cannot deactivate the only active super admin');
    }

    user.isActive = !!isActive;
    if (!isActive) {
      user.refreshToken = '';
      user.adminRefreshToken = '';
    }
    await user.save();
    return { _id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  }

  // Super-admin only: reset an admin's password to a fresh one-time temporary
  // password (returned once). Forces re-login by clearing refresh tokens.
  async resetAdminPassword(targetId, actingUserId) {
    const ApiError = require('../../utils/ApiError');
    const crypto = require('crypto');

    const user = await User.findById(targetId).select('+passwordHash');
    if (!user) throw ApiError.notFound('User not found');
    if (!['superadmin', 'admin', 'manager', 'staff', 'branchadmin'].includes(user.role)) {
      throw ApiError.badRequest('This user is not an admin account');
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    user.passwordHash = tempPassword; // re-hashed by the pre-save hook
    user.mustChangePassword = true;
    user.refreshToken = '';
    user.adminRefreshToken = '';
    await user.save();

    return { _id: user._id, name: user.name, email: user.email, role: user.role, tempPassword };
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
