// Stable, machine-readable default codes per HTTP status. These let the
// frontend branch on `error.code` instead of parsing human-facing messages.
const STATUS_CODE_DEFAULTS = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

const defaultCodeForStatus = (statusCode) => STATUS_CODE_DEFAULTS[statusCode] || `HTTP_${statusCode}`;

class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Human-readable, cause-revealing message
   * @param {Array} errors Per-field details: { field, code, message }
   * @param {string} stack Optional pre-captured stack
   * @param {string} code Machine-readable code; defaults from statusCode
   */
  constructor(statusCode, message, errors = [], stack = '', code = '') {
    super(message);
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    this.code = code || defaultCodeForStatus(statusCode);
    this.data = null;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = 'Bad request', errors = [], code = '') {
    return new ApiError(400, message, errors, '', code);
  }

  static unauthorized(message = 'Unauthorized', errors = [], code = '') {
    return new ApiError(401, message, errors, '', code);
  }

  static forbidden(message = 'Forbidden', errors = [], code = '') {
    return new ApiError(403, message, errors, '', code);
  }

  static notFound(message = 'Resource not found', errors = [], code = '') {
    return new ApiError(404, message, errors, '', code);
  }

  static conflict(message = 'Conflict', errors = [], code = '') {
    return new ApiError(409, message, errors, '', code);
  }

  static tooMany(message = 'Too many requests', errors = [], code = '') {
    return new ApiError(429, message, errors, '', code);
  }

  static internal(message = 'Internal server error', errors = [], code = '') {
    return new ApiError(500, message, errors, '', code);
  }
}

ApiError.defaultCodeForStatus = defaultCodeForStatus;

module.exports = ApiError;
