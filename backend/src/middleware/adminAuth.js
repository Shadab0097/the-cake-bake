const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../utils/constants');

/**
 * Check if authenticated user is admin or superadmin
 */
const adminAuth = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (req.user.role !== USER_ROLES.ADMIN && req.user.role !== USER_ROLES.SUPERADMIN) {
    return next(ApiError.forbidden('Admin access required'));
  }

  next();
};

/**
 * Check if authenticated user is superadmin
 */
const superAdminAuth = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (req.user.role !== USER_ROLES.SUPERADMIN) {
    return next(ApiError.forbidden('Super admin access required'));
  }

  next();
};

module.exports = { adminAuth, superAdminAuth };
