import api from './api';

const adminApi = {
  // Dashboard & Analytics
  dashboard: {
    get: () => api.get('/admin/dashboard'),
    getAnalytics: (days = 30) => api.get(`/admin/analytics?days=${days}`),
  },

  // Products
  products: {
    list: (params) => api.get('/admin/products', { params }),
    create: (data) => api.post('/admin/products', data),
    update: (id, data) => api.put(`/admin/products/${id}`, data),
    delete: (id) => api.delete(`/admin/products/${id}`),
    bulkImport: (products) => api.post('/admin/products/bulk-import', { products }),
    addVariant: (id, data) => api.post(`/admin/products/${id}/variants`, data),
    updateVariant: (id, vid, data) => api.put(`/admin/products/${id}/variants/${vid}`, data),
  },

  // Categories
  categories: {
    list: (params) => api.get('/admin/categories', { params }),
    create: (data) => api.post('/admin/categories', data),
    update: (id, data) => api.put(`/admin/categories/${id}`, data),
    delete: (id) => api.delete(`/admin/categories/${id}`),
  },

  // Orders
  orders: {
    list: (params) => api.get('/admin/orders', { params }),
    get: (id) => api.get(`/admin/orders/${id}`),
    updateStatus: (id, status, note = '') => api.put(`/admin/orders/${id}/status`, { status, note }),
  },

  // Coupons
  coupons: {
    list: (params) => api.get('/admin/coupons', { params }),
    create: (data) => api.post('/admin/coupons', data),
    update: (id, data) => api.put(`/admin/coupons/${id}`, data),
    delete: (id) => api.delete(`/admin/coupons/${id}`),
  },

  // Delivery
  delivery: {
    getSlots: () => api.get('/admin/delivery/slots'),
    createSlot: (data) => api.post('/admin/delivery/slots', data),
    updateSlot: (id, data) => api.put(`/admin/delivery/slots/${id}`, data),
    getZones: () => api.get('/admin/delivery/zones'),
    createZone: (data) => api.post('/admin/delivery/zones', data),
    updateZone: (id, data) => api.put(`/admin/delivery/zones/${id}`, data),
  },

  // Add-Ons
  addons: {
    list: (params) => api.get('/admin/addons', { params }),
    create: (data) => api.post('/admin/addons', data),
    update: (id, data) => api.put(`/admin/addons/${id}`, data),
    delete: (id) => api.delete(`/admin/addons/${id}`),
  },

  // Inquiries
  inquiries: {
    getCustom: (params) => api.get('/admin/inquiries/custom', { params }),
    getCorporate: (params) => api.get('/admin/inquiries/corporate', { params }),
    update: (id, data) => api.put(`/admin/inquiries/${id}`, data),
  },

  // Customers
  customers: {
    list: (params) => api.get('/admin/customers', { params }),
    get: (id) => api.get(`/admin/customers/${id}`),
  },

  // Reviews
  reviews: {
    list: (params) => api.get('/admin/reviews', { params }),
    approve: (id) => api.put(`/admin/reviews/${id}/approve`),
    delete: (id) => api.delete(`/admin/reviews/${id}`),
  },

  // Banners
  banners: {
    list: () => api.get('/admin/banners'),
    create: (data) => api.post('/admin/banners', data),
    update: (id, data) => api.put(`/admin/banners/${id}`, data),
    delete: (id) => api.delete(`/admin/banners/${id}`),
  },

  // Notifications
  notifications: {
    list: (params) => api.get('/admin/notifications', { params }),
    send: (data) => api.post('/admin/notifications/send', data),
  },
};

// Constants shared across admin pages
export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
export const INQUIRY_STATUSES = ['new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled'];
export const COUPON_TYPES = ['percentage', 'flat'];
export const ADDON_CATEGORIES = ['candles', 'flowers', 'cards', 'balloons', 'gifts', 'decorations'];
export const BANNER_POSITIONS = ['hero', 'category', 'promo', 'sidebar'];
export const PRODUCT_TAGS = ['bestseller', 'trending', 'new', 'featured', 'limited'];
export const OCCASIONS = ['birthday', 'anniversary', 'wedding', 'valentines', 'mothers_day', 'fathers_day', 'christmas', 'new_year', 'diwali', 'holi', 'eid', 'rakhi', 'graduation', 'baby_shower', 'engagement', 'farewell', 'thank_you', 'get_well', 'congratulations', 'corporate'];
export const NOTIFICATION_TEMPLATES = ['order_confirmed', 'order_details', 'payment_success', 'payment_failed', 'order_preparing', 'order_packed', 'order_dispatched', 'out_for_delivery', 'order_delivered', 'order_cancelled', 'refund_initiated'];

// Formatter helpers
export const formatPrice = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default adminApi;
