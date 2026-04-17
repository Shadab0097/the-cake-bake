const slugify = require('slugify');
const crypto = require('crypto');

/**
 * Generate a URL-safe slug
 */
const generateSlug = (text) => {
  return slugify(text, { lower: true, strict: true, trim: true });
};

/**
 * Generate a unique order number: CB-YYYYMMDD-XXXX
 */
const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  // Use crypto.randomBytes for collision resistance at high volume
  // 4 bytes = 8 hex chars = ~4 billion combinations vs. previous 9000
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CB-${dateStr}-${random}`;
};

/**
 * Convert rupees to paise
 */
const toPaise = (rupees) => Math.round(rupees * 100);

/**
 * Convert paise to rupees
 */
const toRupees = (paise) => (paise / 100).toFixed(2);

/**
 * Format price for display
 */
const formatPrice = (paise) => {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees);
};

/**
 * Pick specific fields from an object
 */
const pick = (obj, keys) => {
  return keys.reduce((acc, key) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/**
 * Omit specific fields from an object
 */
const omit = (obj, keys) => {
  return Object.keys(obj).reduce((acc, key) => {
    if (!keys.includes(key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/**
 * Check if a date is today
 */
const isToday = (date) => {
  const today = new Date();
  const d = new Date(date);
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

/**
 * Check if a date is in the past
 */
const isPast = (date) => {
  return new Date(date) < new Date();
};

/**
 * Get start of day
 */
const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of day
 */
const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Escape special regex characters in a string to prevent ReDoS attacks.
 * Must be applied to all user-supplied values used in $regex or new RegExp().
 */
const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
  generateSlug,
  generateOrderNumber,
  toPaise,
  toRupees,
  formatPrice,
  pick,
  omit,
  isToday,
  isPast,
  startOfDay,
  endOfDay,
  escapeRegex,
};
