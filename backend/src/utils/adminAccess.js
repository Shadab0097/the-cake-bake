const { USER_ROLES } = require('./constants');

// Admin-area roles (everyone who may reach /admin at all).
const ADMIN_ROLES = new Set([
  USER_ROLES.SUPERADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.STAFF,
]);

// Roles with unrestricted admin access. Legacy 'admin' is treated as full so
// existing accounts keep working exactly as before this change.
const FULL_ROLES = new Set([USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN]);

// Sensitive sections — Super Admin / legacy admin only.
const FINANCIAL_SECTIONS = new Set(['profit', 'insights', 'costs', 'gst', 'settings', 'admins']);

// Sections a Staff member may use (operations only).
const STAFF_SECTIONS = new Set(['dashboard', 'orders', 'refunds', 'delivery', 'inquiries', 'customers']);

// Map an admin path's first segment to a coarse section key. Works for both API
// paths (relative to /admin, e.g. '/profit') and app routes.
const sectionForPath = (path = '') => {
  const segment = String(path).replace(/^\/+/, '').split('/')[0].split('?')[0];
  const map = {
    '': 'dashboard', dashboard: 'dashboard', analytics: 'dashboard',
    sales: 'sales',
    profit: 'profit',
    'customer-analytics': 'insights', insights: 'insights',
    variants: 'costs', costs: 'costs',
    gst: 'gst',
    settings: 'settings', reports: 'settings',
    admins: 'admins',
    orders: 'orders',
    refunds: 'refunds',
    products: 'catalog', categories: 'catalog', addons: 'catalog', banners: 'catalog',
    coupons: 'coupons',
    delivery: 'delivery',
    customers: 'customers',
    reviews: 'reviews',
    inquiries: 'inquiries',
    notifications: 'notifications',
    'audit-logs': 'logs', 'operational-alerts': 'logs', 'application-errors': 'logs', 'payment-diagnostics': 'logs',
    chatbot: 'chatbot',
  };
  return map[segment] || 'other';
};

// Can a role access a section? Managers see everything except financial pages;
// staff see only operations; unknown sections are denied to non-full roles.
const canAccess = (role, section) => {
  if (FULL_ROLES.has(role)) return true;
  if (role === USER_ROLES.MANAGER) return !FINANCIAL_SECTIONS.has(section);
  if (role === USER_ROLES.STAFF) return STAFF_SECTIONS.has(section);
  return false;
};

module.exports = {
  ADMIN_ROLES,
  FULL_ROLES,
  FINANCIAL_SECTIONS,
  STAFF_SECTIONS,
  sectionForPath,
  canAccess,
};
