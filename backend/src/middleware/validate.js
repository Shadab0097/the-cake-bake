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
            message: detail.message.replace(/"/g, ''),
          });
        });
      } else {
        req[source] = value; // Replace with validated/sanitized value
      }
    }
  });

  if (validationErrors.length > 0) {
    return next(ApiError.badRequest('Validation failed', validationErrors));
  }

  next();
};

module.exports = validate;
