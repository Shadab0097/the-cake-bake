'use strict';

const Branch = require('../../models/Branch');
const DeliveryZone = require('../../models/DeliveryZone');
const User = require('../../models/User');
const ApiError = require('../../utils/ApiError');
const deliveryService = require('../delivery/delivery.service');
const adminService = require('./admin.service');

// A branch admin may only create/manage these roles (never another admin, super
// admin, or branch admin — no privilege escalation).
const MANAGEABLE_ROLES = ['staff', 'manager'];
// Branch-admin-editable settings (NOT name/code/isActive — those are identity,
// owner-only via /admin/settings).
const EDITABLE_BRANCH_FIELDS = ['origin', 'invoicePrefix', 'codEnabled', 'reportRecipients', 'reportEnabled'];

const toStringIds = (arr) => (arr || []).map((v) => String(v && v._id ? v._id : v));

class BranchSelfService {
  // scope: null for an owner (all branches) or string[] of the caller's branchIds.

  // ── Branch settings ──────────────────────────────────────────────────────
  async getBranches(scope) {
    const filter = scope ? { _id: { $in: scope } } : {};
    const branches = await Branch.find(filter).sort({ name: 1 }).lean();
    const ids = branches.map((b) => b._id);
    const zones = await DeliveryZone.find({ branchId: { $in: ids } })
      .select('city state pincodes deliveryCharge freeDeliveryAbove sameDayAvailable codEnabled isActive status branchId')
      .sort({ city: 1 })
      .lean();
    const zonesByBranch = zones.reduce((acc, z) => {
      const key = String(z.branchId);
      (acc[key] = acc[key] || []).push(z);
      return acc;
    }, {});
    return branches.map((b) => ({ ...b, zones: zonesByBranch[String(b._id)] || [] }));
  }

  async updateBranch(id, data, scope) {
    // Walled admin may only touch a branch in their set (404 to avoid leaking
    // existence of other branches).
    if (scope && !scope.includes(String(id))) {
      throw ApiError.notFound('Branch not found', [], 'BRANCH_NOT_FOUND');
    }
    const update = {};
    for (const key of EDITABLE_BRANCH_FIELDS) {
      if (data[key] !== undefined) update[key] = data[key];
    }
    if (!Object.keys(update).length) throw ApiError.badRequest('No editable branch fields provided');
    // Reuse deliveryService.updateBranch for its COD write-through + cache bust.
    return deliveryService.updateBranch(id, update);
  }

  // ── Staff management ─────────────────────────────────────────────────────
  // A target is manageable by a walled admin only if it is a staff/manager
  // walled to a NON-EMPTY SUBSET of the actor's branches. Owners (null scope)
  // may manage any staff/manager.
  _canManage(scope, target) {
    if (!MANAGEABLE_ROLES.includes(target.role)) return false;
    if (!scope) return true;
    const targetBranches = toStringIds(target.branchIds);
    if (!targetBranches.length) return false; // unscoped/owner account — never
    return targetBranches.every((b) => scope.includes(b));
  }

  async listStaff(scope) {
    const filter = { role: { $in: MANAGEABLE_ROLES } };
    if (scope) filter.branchIds = { $in: scope };
    const users = await User.find(filter)
      .select('name email phone role branchIds isActive mustChangePassword lastLogin createdAt')
      .populate('branchIds', 'name code')
      .sort({ createdAt: 1 })
      .lean();
    // $in matches any overlap; enforce subset so staff shared with a branch
    // outside the actor's scope is not exposed.
    if (!scope) return users;
    return users.filter((u) => {
      const tb = toStringIds(u.branchIds);
      return tb.length && tb.every((b) => scope.includes(b));
    });
  }

  // Resolve the branch set a new staff member should be walled to: a non-empty
  // subset of the actor's branches (single-branch admins auto-assign).
  _resolveStaffBranches(requested, scope) {
    if (!scope) return Array.isArray(requested) ? requested.map(String) : [];
    let ids = (Array.isArray(requested) ? requested.map(String) : []).filter((b) => scope.includes(b));
    if (!ids.length && scope.length === 1) ids = [scope[0]];
    if (!ids.length) {
      throw ApiError.badRequest('Select which of your branches this team member belongs to', [{ field: 'branchIds', code: 'BRANCH_REQUIRED', message: 'Select one of your branches' }], 'STAFF_BRANCH_REQUIRED');
    }
    return ids;
  }

  async createStaff(payload, scope, actingUserId) {
    const role = payload.role;
    if (!MANAGEABLE_ROLES.includes(role)) {
      throw ApiError.badRequest('A branch admin can only create staff or managers', [{ field: 'role', code: 'ROLE_NOT_ALLOWED', message: 'Only staff or manager roles are allowed' }], 'STAFF_ROLE_NOT_ALLOWED');
    }
    const branchIds = this._resolveStaffBranches(payload.branchIds, scope);
    return adminService.createAdminUser(
      { name: payload.name, email: payload.email, phone: payload.phone, role, branchIds },
      actingUserId,
    );
  }

  async _assertManageable(id, scope, actingUserId) {
    if (String(id) === String(actingUserId)) {
      throw ApiError.badRequest('You cannot manage your own account here');
    }
    const target = await User.findById(id).select('role branchIds').lean();
    if (!target) throw ApiError.notFound('User not found');
    if (!this._canManage(scope, target)) {
      throw ApiError.forbidden('You can only manage staff in your own branch');
    }
  }

  async setStaffActive(id, isActive, scope, actingUserId) {
    await this._assertManageable(id, scope, actingUserId);
    return adminService.setAdminActive(id, isActive, actingUserId);
  }

  async resetStaffPassword(id, scope, actingUserId) {
    await this._assertManageable(id, scope, actingUserId);
    return adminService.resetAdminPassword(id, actingUserId);
  }

  async setStaffBranches(id, branchIds, scope, actingUserId) {
    await this._assertManageable(id, scope, actingUserId);
    // The new branch set must also stay within the actor's branches.
    const resolved = this._resolveStaffBranches(branchIds, scope);
    return adminService.setAdminBranches(id, resolved, actingUserId);
  }
}

module.exports = new BranchSelfService();
module.exports.BranchSelfService = BranchSelfService;
module.exports.MANAGEABLE_ROLES = MANAGEABLE_ROLES;
