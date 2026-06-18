/**
 * Centralized helpers for turning an axios/API error into clear,
 * customer-friendly text plus machine-readable details.
 *
 * The backend now returns errors shaped as:
 *   { success: false, code: 'SOME_CODE', message: 'Human message', errors: [{ field, code, message }] }
 *
 * These helpers prefer the most specific message available, humanize field
 * names, and fall back to friendly copy for network/server problems so users
 * never see raw technical text or empty errors.
 */

const NETWORK_MESSAGE = 'We couldn’t reach the server. Please check your internet connection and try again.';
const TIMEOUT_MESSAGE = 'This is taking longer than expected. Please try again in a moment.';
const SERVER_MESSAGE = 'Something went wrong on our end. Please try again shortly.';
const RATE_LIMIT_MESSAGE = 'You’re doing that a bit too quickly. Please wait a moment and try again.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Convert a field path like "shippingAddress.pincode" or "addressLine1"
 * into a readable label like "Pincode" / "Address Line 1".
 */
export function humanizeField(field = '') {
  const leaf = String(field).split('.').pop() || '';
  return leaf
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/([A-Za-z])(\d)/g, '$1 $2') // line1 -> line 1
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Joi/validation messages embed the raw dotted field path. Replace a leading
 * path with its human label so users see "Pincode must be..." not
 * "shippingAddress.pincode must be...".
 */
function friendlyFieldMessage(field, message) {
  if (!message) return message;
  if (!field) return message;
  const escaped = String(field).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escaped + '\\b');
  if (re.test(message)) {
    return message.replace(re, humanizeField(field));
  }
  return message;
}

/** The backend machine-readable code, or '' when unavailable. */
export function getApiErrorCode(error) {
  return error?.response?.data?.code || '';
}

/**
 * Map of { fieldPath: friendlyMessage } for binding inline errors to inputs.
 */
export function getApiFieldErrors(error) {
  const list = error?.response?.data?.errors;
  if (!Array.isArray(list)) return {};
  const map = {};
  for (const entry of list) {
    if (entry && entry.field && !map[entry.field]) {
      map[entry.field] = friendlyFieldMessage(entry.field, entry.message) || '';
    }
  }
  return map;
}

/**
 * Best single user-facing message for an error.
 * @param {*} error axios error (or anything)
 * @param {string} fallback message when nothing better is available
 */
export function getApiErrorMessage(error, fallback = GENERIC_MESSAGE) {
  // No HTTP response → network, timeout, or CORS failure.
  if (error && !error.response) {
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      return TIMEOUT_MESSAGE;
    }
    if (error.request) return NETWORK_MESSAGE;
    return fallback;
  }

  const status = error?.response?.status;
  const data = error?.response?.data || {};

  // Never surface raw internal messages/stacks for server errors.
  if (status >= 500) return SERVER_MESSAGE;

  // Prefer the most specific, field-level message when present.
  const firstError = Array.isArray(data.errors)
    ? data.errors.find((e) => e && e.message)
    : null;
  if (firstError) {
    const msg = friendlyFieldMessage(firstError.field, firstError.message);
    if (firstError.field) {
      const human = humanizeField(firstError.field);
      return msg.startsWith(human) ? msg : `${human}: ${msg}`;
    }
    return msg;
  }

  if (data.message) return data.message;
  if (status === 429) return RATE_LIMIT_MESSAGE;
  return fallback;
}

/**
 * Convenience bundle for components/forms.
 * @returns {{ message: string, code: string, fieldErrors: Record<string,string> }}
 */
export function extractApiError(error, fallback = GENERIC_MESSAGE) {
  return {
    message: getApiErrorMessage(error, fallback),
    code: getApiErrorCode(error),
    fieldErrors: getApiFieldErrors(error),
  };
}

export const API_ERROR_MESSAGES = {
  NETWORK_MESSAGE,
  TIMEOUT_MESSAGE,
  SERVER_MESSAGE,
  RATE_LIMIT_MESSAGE,
  GENERIC_MESSAGE,
};
