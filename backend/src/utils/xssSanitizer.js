const xss = require('xss');

/**
 * XSS Sanitization Utility
 * Strips all HTML/script tags from user input to prevent stored XSS attacks.
 *
 * Uses the `xss` package with a strict whitelist-based approach:
 * - No HTML tags allowed (whiteList is empty)
 * - All script content stripped
 * - All event handlers removed
 */

// Strict XSS filter options — strip everything
const xssOptions = {
  whiteList: {},           // No tags allowed
  stripIgnoreTag: true,    // Strip tags not in whitelist
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
};

const xssFilter = new xss.FilterXSS(xssOptions);

/**
 * Sanitize a single string value
 * @param {string} str - Input string to sanitize
 * @returns {string} Sanitized string
 */
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return xssFilter.process(str).trim();
};

/**
 * Recursively sanitize all string values in an object
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
};

/**
 * Joi custom validator that sanitizes string input against XSS
 * Usage: Joi.string().custom(joiSanitize)
 *
 * @param {string} value - The value to validate
 * @param {Object} helpers - Joi helpers
 * @returns {string} Sanitized string
 */
const joiSanitize = (value, helpers) => {
  if (typeof value !== 'string') return value;
  const cleaned = sanitize(value);
  // If input was significantly altered (had HTML tags), flag it
  if (cleaned.length < value.length * 0.5 && value.length > 10) {
    return helpers.error('string.xss');
  }
  return cleaned;
};

/**
 * Custom Joi error messages for XSS validation
 */
const joiXssMessages = {
  'string.xss': '{{#label}} contains disallowed HTML content',
};

module.exports = { sanitize, sanitizeObject, joiSanitize, joiXssMessages };
