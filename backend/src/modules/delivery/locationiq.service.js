const axios = require('axios');
const { env } = require('../../config/env');
const cache = require('../../utils/cache');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');

const INDIAN_PIN_RE = /^[1-9][0-9]{5}$/;

/**
 * Pull the most specific city-like label out of a LocationIQ address object.
 * LocationIQ (OSM-derived) is inconsistent about which field holds the city,
 * so we walk from most- to least-specific.
 */
const pickCity = (addr = {}) =>
  addr.city ||
  addr.town ||
  addr.village ||
  addr.suburb ||
  addr.municipality ||
  addr.county ||
  addr.state_district ||
  null;

/**
 * Reverse-geocode browser GPS coordinates into an Indian pincode + city using
 * LocationIQ. Results are cached (coords rounded to ~110m) to protect the
 * free-tier daily quota — coordinate→pincode is effectively static.
 *
 * Contract (so the storefront degrades gracefully):
 *   - Success            → { pincode: '143001'|null, city, state }
 *   - Key not configured → ApiError 400 GEOCODING_DISABLED
 *   - Upstream failure    → ApiError 400 GEOCODING_FAILED
 * A null `pincode` (valid response, no usable postcode) is a normal outcome the
 * frontend treats as "couldn't detect — enter manually".
 *
 * @param {{ lat: number, lng: number }} coords
 * @returns {Promise<{ pincode: string|null, city: string|null, state: string|null }>}
 */
const reverseGeocode = async ({ lat, lng }) => {
  if (!env.locationiq.apiKey) {
    throw ApiError.badRequest(
      'Location detection is not available',
      [{ field: 'lat', code: 'GEOCODING_DISABLED', message: 'Location detection is not available' }],
      'GEOCODING_DISABLED'
    );
  }

  // Round to 3 decimals (~110m): privacy-preserving and a stable cache key.
  const rLat = Number(lat).toFixed(3);
  const rLng = Number(lng).toFixed(3);
  const cacheKey = `delivery:revgeo:${rLat},${rLng}`;

  return cache.getOrSet(
    cacheKey,
    async () => {
      try {
        const res = await axios.get(`${env.locationiq.baseUrl}/reverse`, {
          params: {
            key: env.locationiq.apiKey,
            lat,
            lon: lng,
            format: 'json',
            normalizecity: 1,
            'accept-language': 'en',
          },
          timeout: env.locationiq.timeoutMs,
        });

        const addr = res.data && res.data.address ? res.data.address : {};
        const rawPin = String(addr.postcode || '').replace(/\s+/g, '');

        return {
          pincode: INDIAN_PIN_RE.test(rawPin) ? rawPin : null,
          city: pickCity(addr),
          state: addr.state || null,
        };
      } catch (err) {
        const status = err.response && err.response.status;
        // 401/403 = bad/expired token, 429 = quota/rate exhausted, ECONNABORTED = timeout.
        logger.warn(
          `[LocationIQ] reverse geocode failed (${status || err.code || 'unknown'}): ${err.message}`
        );
        throw ApiError.badRequest(
          'Could not determine your location',
          [{ field: 'lat', code: 'GEOCODING_FAILED', message: 'Could not determine your location' }],
          'GEOCODING_FAILED'
        );
      }
    },
    env.locationiq.cacheTtlSeconds
  );
};

module.exports = { reverseGeocode, pickCity, INDIAN_PIN_RE };
