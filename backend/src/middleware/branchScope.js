const { computeScope } = require('../utils/branchScope');

/**
 * Attach the caller's branch data-scope to every admin request. Handlers read
 * it via `resolveBranchIds(req.branchScope, req.query.branchId)`. Must run after
 * `auth` (needs req.user with its branchIds populated).
 */
module.exports = function branchScope(req, res, next) {
  req.branchScope = computeScope(req.user);
  next();
};
