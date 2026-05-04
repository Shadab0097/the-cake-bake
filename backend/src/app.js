const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const path = require('path');
const fs = require('fs');

const { env } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const requestId = require('./middleware/requestId');
const ApiError = require('./utils/ApiError');

const v1Routes = require('./routes/v1');

const app = express();

// ---- Request Correlation ID — must be first so all logs carry req.id ----
app.use(requestId);

// ---- Trust Proxy (required behind Nginx/load balancer for correct IP) ----
if (env.isProd()) {
  app.set('trust proxy', 1);
}

// ---- Security Middleware ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,  // Allow loading external images
}));
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent HTTP parameter pollution

// ---- CORS ----
app.use(cors({
  origin: env.corsOrigin.split(',').map(o => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ---- Body Parsing ----
// CRITICAL: Skip JSON parsing for webhook route — it needs raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/payments/webhook') {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ---- Request Timeout ----
app.use((req, res, next) => {
  // 30-second timeout per request to prevent hanging connections
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({ success: false, message: 'Request timeout' });
    }
  });
  next();
});

// ---- Compression ----
app.use(compression());

// ---- Request Logging ----
if (env.isDev()) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ---- Static Files (uploads) ----
const uploadDir = path.resolve(env.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
// Serve uploaded files with security headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(uploadDir, {
  maxAge: env.isProd() ? '7d' : 0,   // Cache uploads for 7 days in production
  etag: true,
}));

// ---- Rate Limiting ----
app.use('/api/', apiLimiter);

// ---- HTTP Cache Headers for Public Endpoints ----
app.use('/api/v1/products', (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
  }
  next();
});
app.use('/api/v1/categories', (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  }
  next();
});

// ---- API Routes ----
app.use('/api/v1', v1Routes);

// ---- Root ----
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: `${env.app.name} API Server`,
    version: '1.0.0',
    docs: '/api/v1/health',
  });
});

// ---- 404 Handler ----
app.use((req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// ---- Global Error Handler ----
app.use(errorHandler);

module.exports = app;
