// Client mirror of backend src/utils/adminAccess.js — used only to hide nav and
// pages a role can't use. The backend remains the real authority (it 403s).
export const ADMIN_ROLES = ['superadmin', 'admin', 'manager', 'staff'];

const FINANCIAL_SECTIONS = new Set(['profit', 'insights', 'costs', 'gst', 'settings', 'admins']);
const STAFF_SECTIONS = new Set(['dashboard', 'orders', 'refunds', 'delivery', 'inquiries', 'customers']);

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function canAccess(role, section) {
  if (role === 'superadmin' || role === 'admin') return true;
  if (role === 'manager') return !FINANCIAL_SECTIONS.has(section);
  if (role === 'staff') return STAFF_SECTIONS.has(section);
  return false;
}

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};
