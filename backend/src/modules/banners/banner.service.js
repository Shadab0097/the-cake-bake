const Banner = require('../../models/Banner');

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

    return Banner.find(filter)
      .select('title subtitle image link position sortOrder validFrom validUntil')
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
  }
}

module.exports = new BannerService();
