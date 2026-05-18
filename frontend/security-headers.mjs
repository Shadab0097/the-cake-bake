const RAZORPAY_SOURCES = [
  'https://checkout.razorpay.com',
  'https://api.razorpay.com',
  'https://cdn.razorpay.com',
  'https://*.razorpay.com',
];

const uniq = (values) => [...new Set(values.filter(Boolean))];

export const getOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const getApiOrigins = (env = process.env, nodeEnv = process.env.NODE_ENV) => {
  const isProduction = nodeEnv === 'production';
  const configuredOrigins = [
    getOrigin(env.NEXT_PUBLIC_API_URL),
    getOrigin(env.NEXT_PUBLIC_API_BASE),
  ];

  const devOrigins = isProduction
    ? []
    : [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
      ];

  return uniq([...configuredOrigins, ...devOrigins]);
};

const getConnectSources = (env, nodeEnv) => {
  const isProduction = nodeEnv === 'production';
  const devSources = isProduction
    ? []
    : [
        'http://localhost:*',
        'http://127.0.0.1:*',
        'ws://localhost:*',
        'ws://127.0.0.1:*',
      ];

  return uniq([
    "'self'",
    ...getApiOrigins(env, nodeEnv),
    ...RAZORPAY_SOURCES,
    ...devSources,
  ]);
};

export const buildContentSecurityPolicy = ({
  env = process.env,
  nodeEnv = process.env.NODE_ENV,
} = {}) => {
  const isProduction = nodeEnv === 'production';
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...RAZORPAY_SOURCES,
    ...(!isProduction ? ["'unsafe-eval'"] : []),
  ];

  const apiOrigins = getApiOrigins(env, nodeEnv);
  const directives = [
    ['default-src', ["'self'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['form-action', uniq(["'self'", ...RAZORPAY_SOURCES])],
    ['script-src', uniq(scriptSources)],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['font-src', ["'self'", 'data:']],
    ['img-src', uniq(["'self'", 'data:', 'blob:', 'https:', ...apiOrigins])],
    ['media-src', uniq(["'self'", 'data:', 'blob:', 'https:', ...apiOrigins])],
    ['connect-src', getConnectSources(env, nodeEnv)],
    ['frame-src', uniq(["'self'", ...RAZORPAY_SOURCES])],
    ['child-src', uniq(["'self'", ...RAZORPAY_SOURCES])],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
  ];

  if (isProduction) {
    directives.push(['upgrade-insecure-requests', []]);
  }

  return directives
    .map(([directive, sources]) => {
      if (!sources || sources.length === 0) return directive;
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
};

export const buildSecurityHeaders = ({
  env = process.env,
  nodeEnv = process.env.NODE_ENV,
} = {}) => {
  const headers = [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy({ env, nodeEnv }),
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Permissions-Policy',
      value: [
        'accelerometer=()',
        'camera=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'serial=()',
        'usb=()',
      ].join(', '),
    },
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on',
    },
    {
      key: 'X-Permitted-Cross-Domain-Policies',
      value: 'none',
    },
    {
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin-allow-popups',
    },
    {
      key: 'Cross-Origin-Resource-Policy',
      value: 'same-origin',
    },
    {
      key: 'Origin-Agent-Cluster',
      value: '?1',
    },
  ];

  if (nodeEnv === 'production') {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains; preload',
    });
  }

  return headers;
};
