const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  PACKED: 'packed',
  DISPATCHED: 'dispatched',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const PAYMENT_STATUSES = {
  CREATED: 'created',
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

const COUPON_TYPES = {
  PERCENTAGE: 'percentage',
  FLAT: 'flat',
};

const INQUIRY_STATUSES = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUOTED: 'quoted',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const NOTIFICATION_CHANNELS = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
};

const NOTIFICATION_TYPES = {
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_DETAILS: 'order_details',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  ORDER_PREPARING: 'order_preparing',
  ORDER_PACKED: 'order_packed',
  ORDER_DISPATCHED: 'order_dispatched',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  REFUND_INITIATED: 'refund_initiated',
};

const LOYALTY_TYPES = {
  EARNED: 'earned',
  REDEEMED: 'redeemed',
  EXPIRED: 'expired',
  ADJUSTED: 'adjusted',
};

const REMINDER_TYPES = {
  BIRTHDAY: 'birthday',
  ANNIVERSARY: 'anniversary',
  CUSTOM: 'custom',
};

const PRODUCT_TAGS = ['bestseller', 'trending', 'new', 'featured', 'limited'];

const OCCASIONS = [
  'birthday',
  'anniversary',
  'wedding',
  'valentines',
  'mothers_day',
  'fathers_day',
  'christmas',
  'new_year',
  'diwali',
  'holi',
  'eid',
  'rakhi',
  'graduation',
  'baby_shower',
  'engagement',
  'farewell',
  'thank_you',
  'get_well',
  'congratulations',
  'corporate',
];

const ADDON_CATEGORIES = ['candles', 'flowers', 'cards', 'balloons', 'gifts', 'decorations'];

module.exports = {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  USER_ROLES,
  COUPON_TYPES,
  INQUIRY_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  LOYALTY_TYPES,
  REMINDER_TYPES,
  PRODUCT_TAGS,
  OCCASIONS,
  ADDON_CATEGORIES,
};
