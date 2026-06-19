const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../utils/constants');
const { ADMIN_ROLES } = require('../utils/adminAccess');

/**
 * Check if authenticated user may reach the admin area (any admin-tier role).
 * Per-section restrictions are applied separately by the RBAC guard.
 */
const adminAuth = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  if (!ADMIN_ROLES.has(req.user.role)) {
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
