const DeliveryZone = require('../../models/DeliveryZone');
const ApiError = require('../../utils/ApiError');
const { escapeRegex } = require('../../utils/helpers');

/**
 * Resolve the live, serviceable delivery zone for an address. This is the
 * authoritative server-side gate used at order placement — it must agree with
 * the storefront `check-pincode` lookup (which matches by pincode).
 *
 * Matching strategy (in order):
 *   1. A live zone whose `pincodes` list contains this pincode.
 *   2. A live zone that serves the whole city (empty `pincodes`) by city name.
 *
 * Throws ApiError (badRequest) when no live zone matches — distinguishing a
 * "coming soon" pincode from a genuinely unavailable one.
 *
 * @param {{ pincode: string, city?: string }} address
 * @param {{ session?: import('mongoose').ClientSession }} [options]
 * @returns {Promise<object>} the matched DeliveryZone document
 */
async function resolveServiceableZone({ pincode, city }, options = {}) {
  const { session = null } = options;
  const run = (query) => (session ? query.session(session) : query);

  // 1. Match by pincode (consistent with check-pincode).
  let zone = await run(
    DeliveryZone.findOne({
      pincodes: pincode,
      isActive: true,
      status: { $ne: 'coming_soon' },
    })
  );

  // 2. Fallback: whole-city zones (no explicit pincode list).
  if (!zone && city) {
    zone = await run(
      DeliveryZone.findOne({
        city: { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') },
        isActive: true,
        status: { $ne: 'coming_soon' },
        $or: [{ pincodes: { $size: 0 } }, { pincodes: { $exists: false } }],
      })
    );
  }

  if (!zone) {
    // Give a clearer message if this pincode is configured but not yet live.
    const soon = await DeliveryZone.findOne({
      pincodes: pincode,
      isActive: true,
      status: 'coming_soon',
    }).lean();

    if (soon) {
      throw ApiError.badRequest(
        `Delivery to ${soon.city} is launching soon`,
        [{ field: 'pincode', code: 'DELIVERY_COMING_SOON', message: `Delivery to ${soon.city} is launching soon` }],
        'DELIVERY_COMING_SOON'
      );
    }

    throw ApiError.badRequest(
      `Delivery not available for pincode ${pincode}`,
      [{ field: 'pincode', code: 'DELIVERY_NOT_AVAILABLE_PINCODE', message: `Delivery not available for pincode ${pincode}` }],
      'DELIVERY_NOT_AVAILABLE_PINCODE'
    );
  }

  return zone;
}

/**
 * Enforce same-day rules for an order. Past dates are already blocked by Joi
 * (`deliveryDate.min('now')`); this guards the same-day edge:
 *   - the zone must allow same-day delivery, and
 *   - the request must arrive before the zone's cutoff time.
 *
 * NOTE: time comparison uses the server's local timezone. Deploy the API in IST
 * (or set TZ=Asia/Kolkata) so cutoffs line up with customer expectations.
 *
 * @param {object} zone DeliveryZone document
 * @param {string|Date} deliveryDate
 */
function assertDeliveryDateAllowed(zone, deliveryDate) {
  const date = new Date(deliveryDate);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(
      'Invalid delivery date',
      [{ field: 'deliveryDate', code: 'INVALID_DELIVERY_DATE', message: 'Invalid delivery date' }],
      'INVALID_DELIVERY_DATE'
    );
  }

  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (!isSameDay) return; // future date — fine; past dates rejected upstream

  if (!zone.sameDayAvailable) {
    throw ApiError.badRequest(
      `Same-day delivery isn’t available in ${zone.city}`,
      [{ field: 'deliveryDate', code: 'SAME_DAY_UNAVAILABLE', message: `Same-day delivery isn’t available in ${zone.city}` }],
      'SAME_DAY_UNAVAILABLE'
    );
  }

  const cutoff = (zone.sameDayCutoffTime || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(cutoff);
  if (match) {
    const cutoffMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= cutoffMinutes) {
      throw ApiError.badRequest(
        `Same-day cutoff (${cutoff}) has passed for ${zone.city}`,
        [{ field: 'deliveryDate', code: 'SAME_DAY_CUTOFF_PASSED', message: `Same-day cutoff (${cutoff}) has passed for ${zone.city}` }],
        'SAME_DAY_CUTOFF_PASSED'
      );
    }
  }
}

module.exports = { resolveServiceableZone, assertDeliveryDateAllowed };
