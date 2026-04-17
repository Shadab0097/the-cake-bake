const DeliverySlot = require('../../models/DeliverySlot');
const DeliveryZone = require('../../models/DeliveryZone');
const Order = require('../../models/Order');
const ApiError = require('../../utils/ApiError');
const { startOfDay, endOfDay } = require('../../utils/helpers');
const cache = require('../../utils/cache');

class DeliveryService {
  async getSlots(query) {
    const { date, city } = query;
    const filter = { isActive: true };

    if (city) {
      filter.$or = [
        { cities: { $size: 0 } }, // Available everywhere
        { cities: city },
      ];
    }

    const cacheKey = cache.buildKey('delivery:slots', { city });
    const slots = await cache.getOrSet(cacheKey, () => {
      return DeliverySlot.find(filter).sort({ sortOrder: 1 }).lean();
    }, 300); // Cache 5 minutes

    // Check capacity for each slot on the given date
    if (date) {
      const dayStart = startOfDay(new Date(date));
      const dayEnd = endOfDay(new Date(date));

      // FIX: Single aggregation instead of N+1 queries
      const bookingCounts = await Order.aggregate([
        {
          $match: {
            deliveryDate: { $gte: dayStart, $lte: dayEnd },
            status: { $nin: ['cancelled', 'refunded'] },
          },
        },
        {
          $group: {
            _id: '$deliverySlot.label',
            bookedCount: { $sum: 1 },
          },
        },
      ]);

      // Build a lookup map for O(1) access
      const bookingMap = {};
      for (const entry of bookingCounts) {
        bookingMap[entry._id] = entry.bookedCount;
      }

      return slots.map((slot) => {
        const bookedCount = bookingMap[slot.label] || 0;
        return {
          ...slot,
          bookedCount,
          available: bookedCount < slot.maxOrders,
          remainingCapacity: slot.maxOrders - bookedCount,
        };
      });
    }

    return slots;
  }

  async checkPincode(pincode) {
    const cacheKey = `delivery:pincode:${pincode}`;
    return cache.getOrSet(cacheKey, async () => {
      const zone = await DeliveryZone.findOne({
        pincodes: pincode,
        isActive: true,
      }).lean();

      if (!zone) {
        return {
          serviceable: false,
          message: 'Delivery not available for this pincode',
        };
      }

      return {
        serviceable: true,
        city: zone.city,
        deliveryCharge: zone.deliveryCharge,
        freeDeliveryAbove: zone.freeDeliveryAbove,
        sameDayAvailable: zone.sameDayAvailable,
        sameDayCutoffTime: zone.sameDayCutoffTime,
      };
    }, 600); // Cache 10 minutes — zones rarely change
  }

  async getZones() {
    return cache.getOrSet('delivery:zones', () => {
      return DeliveryZone.find({ isActive: true })
        .select('city deliveryCharge freeDeliveryAbove sameDayAvailable')
        .sort({ city: 1 })
        .lean();
    }, 300); // Cache 5 minutes
  }

  // Admin CRUD — invalidate cache on changes
  async createSlot(data) {
    cache.invalidatePattern('delivery:');
    return DeliverySlot.create(data);
  }
  async updateSlot(id, data) {
    const slot = await DeliverySlot.findByIdAndUpdate(id, data, { new: true });
    if (!slot) throw ApiError.notFound('Slot not found');
    cache.invalidatePattern('delivery:');
    return slot;
  }
  async createZone(data) {
    cache.invalidatePattern('delivery:');
    return DeliveryZone.create(data);
  }
  async updateZone(id, data) {
    const zone = await DeliveryZone.findByIdAndUpdate(id, data, { new: true });
    if (!zone) throw ApiError.notFound('Zone not found');
    cache.invalidatePattern('delivery:');
    return zone;
  }
  async adminGetSlots() { return DeliverySlot.find().sort({ sortOrder: 1 }).lean(); }
  async adminGetZones() { return DeliveryZone.find().sort({ city: 1 }).lean(); }
}

module.exports = new DeliveryService();

