'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const branchSelfService = require('./branchSelf.service');

// Caller's branch scope: null for an owner (all branches) or string[] for a
// walled admin (their branchIds). req.branchScope is set by the branchScope
// middleware mounted on the self-management sub-router.
const scopeOf = (req) => (req.branchScope?.global ? null : req.branchScope.branchIds);

const getMyBranches = asyncHandler(async (req, res) => {
  const data = await branchSelfService.getBranches(scopeOf(req));
  ApiResponse.ok(data).send(res);
});

const updateMyBranch = asyncHandler(async (req, res) => {
  const data = await branchSelfService.updateBranch(req.params.id, req.body, scopeOf(req));
  ApiResponse.ok(data, 'Branch settings updated').send(res);
});

const listMyStaff = asyncHandler(async (req, res) => {
  const data = await branchSelfService.listStaff(scopeOf(req));
  ApiResponse.ok(data).send(res);
});

const createMyStaff = asyncHandler(async (req, res) => {
  const data = await branchSelfService.createStaff(req.body, scopeOf(req), req.user._id);
  ApiResponse.created(data, 'Team member created').send(res);
});

const setMyStaffActive = asyncHandler(async (req, res) => {
  const data = await branchSelfService.setStaffActive(req.params.id, req.body.isActive, scopeOf(req), req.user._id);
  ApiResponse.ok(data, data.isActive ? 'Team member activated' : 'Team member deactivated').send(res);
});

const resetMyStaffPassword = asyncHandler(async (req, res) => {
  const data = await branchSelfService.resetStaffPassword(req.params.id, scopeOf(req), req.user._id);
  ApiResponse.ok(data, 'Password reset').send(res);
});

const setMyStaffBranches = asyncHandler(async (req, res) => {
  const data = await branchSelfService.setStaffBranches(req.params.id, req.body.branchIds, scopeOf(req), req.user._id);
  ApiResponse.ok(data, 'Branch access updated').send(res);
});

module.exports = {
  getMyBranches,
  updateMyBranch,
  listMyStaff,
  createMyStaff,
  setMyStaffActive,
  resetMyStaffPassword,
  setMyStaffBranches,
};
