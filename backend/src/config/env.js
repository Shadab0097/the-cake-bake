const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
];

const validateEnv = () => {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (process.env.NODE_ENV === 'production' && !process.env.WHATSAPP_APP_SECRET) {
    missing.push('WHATSAPP_APP_SECRET');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    missing.push('REDIS_URL');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI,

  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    // Token you set in Meta Developer Console → Webhook → Verify Token
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    // App Secret from Meta Developer Console, used to verify X-Hub-Signature-256
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },

  // ── WhatsApp Chatbot ────────────────────────────────────────────────────
  chatbot: {
    fallbackMessage: process.env.CHATBOT_FALLBACK_MESSAGE ||
      'Thank you for reaching out! 🎂 Our team will get back to you shortly. For immediate help, please call us.',
  },

  // ── Loyalty Points ─────────────────────────────────────────────────────
  loyalty: {
    pointsPerRupee: parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE) || 0.01,   // 0.01 = 1 pt per ₹100
    pointValue: parseInt(process.env.LOYALTY_POINT_VALUE, 10) || 100,            // paise per point (100 = ₹1)
    minRedeem: parseInt(process.env.LOYALTY_MIN_REDEEM, 10) || 50,               // minimum points to redeem
    maxRedeemPercent: parseInt(process.env.LOYALTY_MAX_REDEEM_PERCENT, 10) || 20, // max % of order total
    expiryDays: parseInt(process.env.LOYALTY_EXPIRY_DAYS, 10) || 365,            // 0 = never expire
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'the-cake-bake',
  },

  orders: {
    expiryJobEnabled: process.env.ENABLE_ORDER_EXPIRY_JOB !== 'false',
    onlinePaymentExpiryMinutes: parsePositiveInt(process.env.ORDER_PAYMENT_EXPIRY_MINUTES, 30),
    expiryJobIntervalMinutes: parsePositiveInt(process.env.ORDER_EXPIRY_JOB_INTERVAL_MINUTES, 5),
    expiryBatchSize: parsePositiveInt(process.env.ORDER_EXPIRY_BATCH_SIZE, 100),
  },

  redis: {
    url: process.env.REDIS_URL || '',
    tls: process.env.REDIS_TLS === 'true',
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'the-cake-bake',
  },

  cache: {
    store: process.env.NODE_ENV === 'production' ? 'redis' : (process.env.CACHE_STORE || 'memory'),
    defaultTtlSeconds: parsePositiveInt(process.env.CACHE_DEFAULT_TTL_SECONDS, 60),
  },

  rateLimit: {
    store: process.env.NODE_ENV === 'production' ? 'redis' : (process.env.RATE_LIMIT_STORE || 'memory'),
  },

  jobs: {
    queueMode: process.env.NODE_ENV === 'production'
      ? 'bullmq'
      : (process.env.JOB_QUEUE_MODE || (process.env.REDIS_URL ? 'bullmq' : 'inline')),
    workerEnabled: process.env.ENABLE_JOB_WORKER !== 'false',
    defaultAttempts: parsePositiveInt(process.env.JOB_DEFAULT_ATTEMPTS, 3),
    backoffMs: parsePositiveInt(process.env.JOB_BACKOFF_MS, 5000),
    removeOnCompleteAgeSeconds: parsePositiveInt(process.env.JOB_REMOVE_ON_COMPLETE_AGE_SECONDS, 86400),
    removeOnFailAgeSeconds: parsePositiveInt(process.env.JOB_REMOVE_ON_FAIL_AGE_SECONDS, 604800),
  },

  paymentReconciliation: {
    enabled: process.env.ENABLE_PAYMENT_RECONCILIATION_JOB !== 'false',
    intervalMinutes: parsePositiveInt(process.env.PAYMENT_RECONCILIATION_INTERVAL_MINUTES, 10),
    minAgeMinutes: parsePositiveInt(process.env.PAYMENT_RECONCILIATION_MIN_AGE_MINUTES, 5),
    lookbackHours: parsePositiveInt(process.env.PAYMENT_RECONCILIATION_LOOKBACK_HOURS, 72),
    batchSize: parsePositiveInt(process.env.PAYMENT_RECONCILIATION_BATCH_SIZE, 100),
  },

  stockReservationExpiry: {
    enabled: process.env.ENABLE_STOCK_RESERVATION_EXPIRY_JOB !== 'false',
    intervalMinutes: parsePositiveInt(process.env.STOCK_RESERVATION_EXPIRY_INTERVAL_MINUTES, 5),
    batchSize: parsePositiveInt(process.env.STOCK_RESERVATION_EXPIRY_BATCH_SIZE, 100),
  },

  health: {
    checkToken: process.env.HEALTH_CHECK_TOKEN || '',
  },

  monitoring: {
    alertWebhookUrl: process.env.OPERATIONAL_ALERT_WEBHOOK_URL || '',
    alertWebhookToken: process.env.OPERATIONAL_ALERT_WEBHOOK_TOKEN || '',
    alertCooldownMinutes: parsePositiveInt(process.env.OPERATIONAL_ALERT_COOLDOWN_MINUTES, 15),
    alertWebhookTimeoutMs: parsePositiveInt(process.env.OPERATIONAL_ALERT_WEBHOOK_TIMEOUT_MS, 3000),
  },

  codAbuse: {
    enabled: process.env.ENABLE_COD_ABUSE_CONTROLS !== 'false',
    maxOrderAmount: parsePositiveInt(process.env.COD_MAX_ORDER_AMOUNT, 500000),
    reviewOrderAmount: parsePositiveInt(process.env.COD_REVIEW_ORDER_AMOUNT, 250000),
    phoneOrderLimit: parsePositiveInt(process.env.COD_PHONE_ORDER_LIMIT, 5),
    phoneOrderWindowHours: parsePositiveInt(process.env.COD_PHONE_ORDER_WINDOW_HOURS, 24),
    guestIpOrderLimit: parsePositiveInt(process.env.COD_GUEST_IP_ORDER_LIMIT, 3),
    guestIpOrderWindowHours: parsePositiveInt(process.env.COD_GUEST_IP_ORDER_WINDOW_HOURS, 1),
    addressCancelLimit: parsePositiveInt(process.env.COD_ADDRESS_CANCEL_LIMIT, 3),
    addressCancelWindowDays: parsePositiveInt(process.env.COD_ADDRESS_CANCEL_WINDOW_DAYS, 30),
    disposableEmailDomains: (process.env.COD_DISPOSABLE_EMAIL_DOMAINS ||
      'mailinator.com,tempmail.com,10minutemail.com,guerrillamail.com,yopmail.com')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  },

  cancellation: {
    customerCutoffHours: parsePositiveInt(process.env.CUSTOMER_CANCELLATION_CUTOFF_HOURS, 12),
  },

  app: {
    name: process.env.APP_NAME || 'The Cake Bake',
    url: process.env.APP_URL || 'http://localhost:3000',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@cakebake.in',
  },

  // ── Global notification channel toggles ─────────────────────────────────
  // Controlled via .env: ENABLE_EMAIL_NOTIFICATIONS / ENABLE_WHATSAPP_NOTIFICATIONS
  // Both false = silent mode (no external calls). Safe for local development.
  notifications: {
    emailEnabled: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    whatsappEnabled: process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true',
  },

  // ── Nodemailer / SMTP config ─────────────────────────────────────────────
  // Gmail: use App Password (not your account password).
  // Production: swap host/port/credentials for SendGrid / Mailgun / Brevo.
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',   // true only for port 465
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'The Cake Bake',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@thecakebake.in',
  },

  // ── Admin alert recipients ────────────────────────────────────────────────
  // Comma-separated in .env → parsed into an array here for multi-recipient support
  adminAlertEmails: (process.env.ADMIN_ALERT_EMAILS || process.env.ADMIN_EMAIL || 'admin@cakebake.in')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),

  isDev: () => env.nodeEnv === 'development',
  isProd: () => env.nodeEnv === 'production',
};

module.exports = { env, validateEnv };
