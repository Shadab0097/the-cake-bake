// Client mirror of backend src/utils/adminAccess.js — used only to hide nav and
// pages a role can't use. The backend remains the real authority (it 403s).
export const ADMIN_ROLES = ['superadmin', 'admin', 'manager', 'staff', 'branchadmin'];

const FINANCIAL_SECTIONS = new Set(['profit', 'insights', 'costs', 'gst', 'settings', 'admins']);
const STAFF_SECTIONS = new Set(['dashboard', 'orders', 'refunds', 'delivery', 'inquiries', 'customers']);
// Sections a walled (branch-scoped) admin may use — only surfaces whose data is
// already branch-scoped server-side. Mirrors backend BRANCHADMIN_SECTIONS and
// grows as more entities get scoped.
const BRANCHADMIN_SECTIONS = new Set([
  'dashboard', 'orders', 'refunds', 'sales', 'profit', // order-derived
  'coupons', 'inquiries', 'customers', // per-branch entities
]);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

// Whether a user is walled to specific branches (vs owner/HQ who sees all).
export function isBranchScoped(user) {
  return Array.isArray(user?.branchIds) && user.branchIds.length > 0;
}

// canAccess(role, section[, branchScoped]) — when branchScoped is true the user
// is additionally confined to the branch-scoped surface set, regardless of role
// (a branch-scoped manager/staff must not reach a not-yet-scoped section).
export function canAccess(role, section, branchScoped = false) {
  let ok;
  if (role === 'superadmin' || role === 'admin') ok = true;
  else if (role === 'manager') ok = !FINANCIAL_SECTIONS.has(section);
  else if (role === 'staff') ok = STAFF_SECTIONS.has(section);
  else if (role === 'branchadmin') ok = BRANCHADMIN_SECTIONS.has(section);
  else ok = false;
  if (ok && branchScoped) return BRANCHADMIN_SECTIONS.has(section);
  return ok;
}

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  branchadmin: 'Branch Admin',
};
