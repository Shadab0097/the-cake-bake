const Banner = require('../../models/Banner');
const cache = require('../../utils/cache');

const ALLOWED_POSITIONS = new Set(['hero', 'category', 'promo', 'sidebar']);

class BannerService {
  async listPublicBanners(query = {}) {
    const now = new Date();
    const filter = {
      isActive: true,
      validFrom: { $lte: now },
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: null },
        { validUntil: { $gte: now } },
      ],
    };

    if (query.position && ALLOWED_POSITIONS.has(query.position)) {
      filter.position = query.position;
    }

    const cacheKey = cache.buildKey('banners:public', {
      position: query.position,
      minute: Math.floor(now.getTime() / 60000),
    });

    return cache.getOrSet(cacheKey, () => {
      return Banner.find(filter)
        .select('title subtitle image link position sortOrder validFrom validUntil')
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
    }, 60);
  }
}

module.exports = new BannerService();
