// Thin promise wrapper around the browser Geolocation API plus the feature
// flag check. Kept framework-agnostic (no React/Redux) so it can be unit tested
// and reused. All failures reject with a typed `code` the caller can branch on:
//   GEO_UNSUPPORTED | GEO_DENIED | GEO_UNAVAILABLE | GEO_TIMEOUT
//
// Geolocation requires a secure context (HTTPS or localhost) and triggers the
// browser's own permission prompt the first time — that prompt is unavoidable
// and intentional.

export const GEO_ERRORS = Object.freeze({
  UNSUPPORTED: 'GEO_UNSUPPORTED',
  DENIED: 'GEO_DENIED',
  UNAVAILABLE: 'GEO_UNAVAILABLE',
  TIMEOUT: 'GEO_TIMEOUT',
});

/** Whether auto-detect is enabled via env (default on unless explicitly 'false'). */
export const isGeolocationEnabled = () =>
  process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION !== 'false';

/** Whether the current runtime can actually use geolocation. */
export const isGeolocationSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.geolocation;

const makeError = (code, message) => {
  const err = new Error(message || code);
  err.code = code;
  return err;
};

/**
 * If the Permissions API reports geolocation as already 'denied', we can skip
 * calling getCurrentPosition entirely (it would just error). Best-effort only —
 * resolves to a permission state string or 'unknown'.
 */
export const getGeolocationPermissionState = async () => {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state; // 'granted' | 'prompt' | 'denied'
  } catch {
    return 'unknown';
  }
};

/**
 * Resolve the current position as { lat, lng, accuracy }.
 * @param {{ timeout?: number, maximumAge?: number, enableHighAccuracy?: boolean }} [options]
 * @returns {Promise<{ lat: number, lng: number, accuracy: number }>}
 */
export const getCurrentPosition = ({
  timeout = 10000,
  maximumAge = 600000, // accept a cached fix up to 10 min old
  enableHighAccuracy = false, // city/pincode granularity doesn't need GPS-grade accuracy
} = {}) =>
  new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(makeError(GEO_ERRORS.UNSUPPORTED, 'Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        const code =
          err.code === 1
            ? GEO_ERRORS.DENIED
            : err.code === 3
              ? GEO_ERRORS.TIMEOUT
              : GEO_ERRORS.UNAVAILABLE;
        reject(makeError(code, err.message));
      },
      { timeout, maximumAge, enableHighAccuracy }
    );
  });
