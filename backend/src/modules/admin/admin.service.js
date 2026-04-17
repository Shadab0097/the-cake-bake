const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Payment = require('../../models/Payment');
const { startOfDay, endOfDay, escapeRegex } = require('../../utils/helpers');
const cache = require('../../utils/cache');

class AdminService {
  /**
   * Dashboard overview — sales stats, order counts, revenue
   */
  async getDashboard(query) {
    // Cache dashboard for 60 seconds to prevent DB overload from rapid refreshes
    return cache.getOrSet('admin:dashboard', async () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

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
      Order.countDocuments({ status: { $in: ['pending', 'confirmed'] } }),

      // Recent orders — show ALL orders (including guest orders with null user)
      Order.find({})
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber user guestInfo items shippingAddress total status paymentStatus paymentMethod deliveryDate deliverySlot createdAt')
        .lean(),

      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

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
}

module.exports = new AdminService();
