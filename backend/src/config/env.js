const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

// Express "trust proxy" setting. Controls how req.ip / X-Forwarded-For is derived,
// which underpins per-IP rate limiting and COD-abuse checks. Set TRUST_PROXY to the
// number of proxy hops in front of the app (e.g. CDN + Nginx = 2). Also accepts
// true/false, a CIDR, 'loopback', or a comma-separated list. Defaults to 1.
const parseTrustProxy = (value) => {
  if (value === undefined || value === null || value === '') return 1;
  const normalized = String(value).trim();
  if (normalized.toLowerCase() === 'true') return true;
  if (normalized.toLowerCase() === 'false') return false;
  const num = Number(normalized);
  if (Number.isInteger(num) && num >= 0) return num;
  return normalized;
};

const PROCESS_ROLES = Object.freeze({
  ALL: 'all',
  WEB: 'web',
  WORKER: 'worker',
  SCHEDULER: 'scheduler',
});

const VALID_PROCESS_ROLES = new Set(Object.values(PROCESS_ROLES));
const VALID_QUEUE_MODES = new Set(['inline', 'bullmq']);
const PLACEHOLDER_PATTERN = /(change-in-production|placeholder|replace|xxxxx|your-|example|test-secret|jwt-secret|refresh-secret)/i;

const normalizeProcessRole = (value) => {
  const normalized = String(value || PROCESS_ROLES.ALL).trim().toLowerCase();
  return VALID_PROCESS_ROLES.has(normalized) ? normalized : value;
};

const normalizeQueueMode = () => {
  if (process.env.NODE_ENV === 'production') return 'bullmq';
  return String(process.env.JOB_QUEUE_MODE || (process.env.REDIS_URL ? 'bullmq' : 'inline')).trim().toLowerCase();
};

const splitCsv = (value = '') => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const isPlaceholder = (value = '') => !value || PLACEHOLDER_PATTERN.test(String(value));

const isLocalOrigin = (origin = '') => {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
  } catch {
    return false;
  }
};

const isHttpsUrl = (value = '') => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
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
  const processRole = normalizeProcessRole(process.env.PROCESS_ROLE);
  const requestedQueueMode = process.env.JOB_QUEUE_MODE
    ? String(process.env.JOB_QUEUE_MODE).trim().toLowerCase()
    : '';
  const queueMode = normalizeQueueMode();

  if (!VALID_PROCESS_ROLES.has(processRole)) {
    throw new Error(`Invalid PROCESS_ROLE "${process.env.PROCESS_ROLE}". Expected one of: ${[...VALID_PROCESS_ROLES].join(', ')}`);
  }

  if (requestedQueueMode && !VALID_QUEUE_MODES.has(requestedQueueMode)) {
    throw new Error(`Invalid JOB_QUEUE_MODE "${process.env.JOB_QUEUE_MODE}". Expected one of: ${[...VALID_QUEUE_MODES].join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production' && requestedQueueMode && requestedQueueMode !== 'bullmq') {
    throw new Error('NODE_ENV=production requires JOB_QUEUE_MODE=bullmq');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.WHATSAPP_APP_SECRET) {
    missing.push('WHATSAPP_APP_SECRET');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    missing.push('REDIS_URL');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    const productionErrors = [];
    const allowInsecureOrigins = process.env.ALLOW_INSECURE_PRODUCTION_ORIGINS === 'true';
    const allowTestPaymentKeys = process.env.ALLOW_TEST_PAYMENT_KEYS === 'true';

    if (isPlaceholder(process.env.JWT_SECRET) || String(process.env.JWT_SECRET || '').length < 32) {
      productionErrors.push('JWT_SECRET must be a unique production secret with at least 32 characters');
    }

    if (isPlaceholder(process.env.JWT_REFRESH_SECRET) || String(process.env.JWT_REFRESH_SECRET || '').length < 32) {
      productionErrors.push('JWT_REFRESH_SECRET must be a unique production secret with at least 32 characters');
    }

    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      productionErrors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }

    if (!process.env.RAZORPAY_WEBHOOK_SECRET || isPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET)) {
      productionErrors.push('RAZORPAY_WEBHOOK_SECRET is required in production');
    }

    if (!allowTestPaymentKeys && !String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live_')) {
      productionErrors.push('RAZORPAY_KEY_ID must be a live key in production, or set ALLOW_TEST_PAYMENT_KEYS=true for staging only');
    }

    const corsOrigins = splitCsv(process.env.CORS_ORIGIN || '');
    if (corsOrigins.length === 0) {
      productionErrors.push('CORS_ORIGIN must include the production frontend origin');
    }
    if (!allowInsecureOrigins && corsOrigins.some((origin) => !isHttpsUrl(origin) || isLocalOrigin(origin))) {
      productionErrors.push('CORS_ORIGIN must use public HTTPS origins in production');
    }

    if (!allowInsecureOrigins && (!isHttpsUrl(process.env.APP_URL || '') || isLocalOrigin(process.env.APP_URL || ''))) {
      productionErrors.push('APP_URL must be the public HTTPS frontend URL in production');
    }

    if (!process.env.HEALTH_CHECK_TOKEN || String(process.env.HEALTH_CHECK_TOKEN).length < 24) {
      productionErrors.push('HEALTH_CHECK_TOKEN must be set to a random value with at least 24 characters in production');
    }

    if (
      isPlaceholder(process.env.CLOUDINARY_CLOUD_NAME) ||
      isPlaceholder(process.env.CLOUDINARY_API_KEY) ||
      isPlaceholder(process.env.CLOUDINARY_API_SECRET)
    ) {
      productionErrors.push('Cloudinary credentials are required for production image uploads');
    }

    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
      if (
        isPlaceholder(process.env.SMTP_USER) ||
        isPlaceholder(process.env.SMTP_PASS) ||
        isPlaceholder(process.env.SMTP_FROM_EMAIL)
      ) {
        productionErrors.push('SMTP credentials are required when ENABLE_EMAIL_NOTIFICATIONS=true');
      }
    }

    if (process.env.ENABLE_WHATSAPP_NOTIFICATIONS === 'true') {
      if (
        isPlaceholder(process.env.WHATSAPP_ACCESS_TOKEN) ||
        isPlaceholder(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
        isPlaceholder(process.env.WHATSAPP_VERIFY_TOKEN) ||
        isPlaceholder(process.env.WHATSAPP_APP_SECRET)
      ) {
        productionErrors.push('WhatsApp credentials are required when ENABLE_WHATSAPP_NOTIFICATIONS=true');
      }
    }

    if (productionErrors.length > 0) {
      throw new Error(`Production configuration is not safe: ${productionErrors.join('; ')}`);
    }
  }

  if (processRole === PROCESS_ROLES.WORKER && process.env.ENABLE_JOB_WORKER === 'false') {
    throw new Error('PROCESS_ROLE=worker requires ENABLE_JOB_WORKER=true');
  }

  if (process.env.NODE_ENV === 'production' && processRole === PROCESS_ROLES.WORKER && queueMode !== 'bullmq') {
    throw new Error('PROCESS_ROLE=worker requires JOB_QUEUE_MODE=bullmq in production');
  }
};

const dbMaxPoolSize = parsePositiveInt(process.env.DB_POOL_SIZE, 50);
const dbMinPoolSize = Math.min(
  parseNonNegativeInt(process.env.DB_MIN_POOL_SIZE, Math.min(10, dbMaxPoolSize)),
  dbMaxPoolSize
);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  processRole: normalizeProcessRole(process.env.PROCESS_ROLE),
  port: parseInt(process.env.PORT, 10) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  mongoUri: process.env.MONGODB_URI,

  db: {
    maxPoolSize: dbMaxPoolSize,
    minPoolSize: dbMinPoolSize,
    serverSelectionTimeoutMs: parsePositiveInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS, 5000),
    socketTimeoutMs: parsePositiveInt(process.env.DB_SOCKET_TIMEOUT_MS, 45000),
    heartbeatFrequencyMs: parsePositiveInt(process.env.DB_HEARTBEAT_FREQUENCY_MS, 10000),
    // Per-process connection budget = (cluster connection limit) / (total app processes).
    // 0 disables the startup advisory. Used to catch pool-vs-Atlas-cap misconfig early.
    connectionBudget: parseNonNegativeInt(process.env.DB_CONNECTION_BUDGET, 0),
  },

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

  // ── LocationIQ reverse geocoding ─────────────────────────────────────────
  // Powers the storefront "auto-detect my location" feature: browser GPS
  // coordinates are reverse-geocoded into an Indian pincode that then flows
  // through the existing /delivery/check-pincode serviceability lookup.
  // Optional: when apiKey is empty the endpoint returns GEOCODING_DISABLED and
  // the frontend silently falls back to manual pincode entry.
  locationiq: {
    apiKey: process.env.LOCATIONIQ_API_KEY || '',
    // Use 'https://eu1.locationiq.com/v1' for EU-region tokens.
    baseUrl: (process.env.LOCATIONIQ_BASE_URL || 'https://us1.locationiq.com/v1').replace(/\/+$/, ''),
    timeoutMs: parsePositiveInt(process.env.LOCATIONIQ_TIMEOUT_MS, 5000),
    // Coordinates → pincode is effectively static, so cache aggressively to
    // protect the free-tier daily quota. Default 1 day.
    cacheTtlSeconds: parsePositiveInt(process.env.LOCATIONIQ_CACHE_TTL_SECONDS, 86400),
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
    queueMode: normalizeQueueMode(),
    workerEnabled: process.env.ENABLE_JOB_WORKER !== 'false',
    workerConcurrency: parsePositiveInt(process.env.JOB_WORKER_CONCURRENCY, 5),
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

  logging: {
    applicationErrorEventsEnabled: process.env.ENABLE_APPLICATION_ERROR_EVENTS !== 'false',
    applicationErrorRetentionDays: Math.min(parsePositiveInt(process.env.APPLICATION_ERROR_RETENTION_DAYS, 14), 90),
    applicationErrorMinWriteIntervalSeconds: Math.min(
      parsePositiveInt(process.env.APPLICATION_ERROR_MIN_WRITE_INTERVAL_SECONDS, 60),
      3600
    ),
    paymentWebhookEventRetentionDays: Math.min(parsePositiveInt(process.env.PAYMENT_WEBHOOK_EVENT_RETENTION_DAYS, 90), 365),
    paymentEmbeddedWebhookEventLimit: Math.min(parsePositiveInt(process.env.PAYMENT_EMBEDDED_WEBHOOK_EVENT_LIMIT, 50), 100),
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

module.exports = {
  PROCESS_ROLES,
  env,
  normalizeProcessRole,
  validateEnv,
};
