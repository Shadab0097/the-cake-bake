const ApiError = require('../utils/ApiError');

/**
 * Validate request data against a Joi schema
 * @param {Object} schema - Joi schema with optional body, params, query keys
 */
const validate = (schema) => (req, res, next) => {
  const validationErrors = [];

  ['body', 'params', 'query'].forEach((source) => {
    if (schema[source]) {
      const { error, value } = schema[source].validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
      });

      if (error) {
        error.details.forEach((detail) => {
          validationErrors.push({
            field: detail.path.join('.'),
            // Stable machine-readable code derived from the Joi rule, e.g.
            // 'any.required' -> 'ANY_REQUIRED', 'string.email' -> 'STRING_EMAIL'.
            code: String(detail.type || 'invalid').toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
            message: detail.message.replace(/"/g, ''),
          });
        });
      } else {
        req[source] = value; // Replace with validated/sanitized value
      }
    }
  });

  if (validationErrors.length > 0) {
    // Surface the actual first problem instead of a generic "Validation failed".
    const [first] = validationErrors;
    const extra = validationErrors.length - 1;
    const summary = extra > 0
      ? `${first.message} (and ${extra} more validation ${extra === 1 ? 'issue' : 'issues'})`
      : first.message;
    return next(ApiError.badRequest(summary, validationErrors, 'VALIDATION_ERROR'));
  }

  next();
};

module.exports = validate;
