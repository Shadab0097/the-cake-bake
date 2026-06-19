import { buildSecurityHeaders } from './security-headers.mjs';

const splitCsv = (value = '') => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const getUrlHost = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
};

const getUploadsPatternFromUrl = (value, { includePath = false } = {}) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const basePath = includePath && url.pathname !== '/'
      ? url.pathname.replace(/\/+$/, '')
      : '';

    return {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: url.port,
      pathname: `${basePath}/uploads/**`,
    };
  } catch {
    return null;
  }
};

const uniqPatterns = (patterns) => {
  const seen = new Set();
  return patterns.filter((pattern) => {
    const key = `${pattern.protocol || ''}:${pattern.hostname || ''}:${pattern.port || ''}:${pattern.pathname || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildImageRemotePatterns = (env = process.env) => {
  const productionImageHosts = [
    'api.thecakebake.in',
    'thecakebake.in',
    'www.thecakebake.in',
    getUrlHost(env.NEXT_PUBLIC_API_URL),
    getUrlHost(env.NEXT_PUBLIC_API_BASE),
    ...splitCsv(env.NEXT_PUBLIC_IMAGE_DOMAINS).map((value) => getUrlHost(value) || value),
  ].filter(Boolean);
  const cdnPattern = getUploadsPatternFromUrl(env.NEXT_PUBLIC_CDN_BASE_URL, { includePath: true });

  const cloudinaryCloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME || '';
  const cloudinaryPathname = cloudinaryCloudName
    ? `/${cloudinaryCloudName}/image/upload/**`
    : '/**';

  return uniqPatterns([
    {
      protocol: 'http',
      hostname: 'localhost',
      port: '5000',
      pathname: '/uploads/**',
    },
    {
      protocol: 'http',
      hostname: '127.0.0.1',
      port: '5000',
      pathname: '/uploads/**',
    },
    ...(cdnPattern ? [cdnPattern] : []),
    ...productionImageHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
      pathname: '/uploads/**',
    })),
    {
      protocol: 'https',
      hostname: 'res.cloudinary.com',
      pathname: cloudinaryPathname,
    },
    {
      protocol: 'https',
      hostname: '*.googleusercontent.com',
    },
    {
      protocol: 'https',
      hostname: 'images.unsplash.com',
    },
  ]);
};

/** @type {import('next').NextConfig} */
const extraDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// NEXT_PUBLIC_CLEAN_UI=true → hide the Next.js dev indicator (the bottom logo)
// and the Agentation feedback overlay (see DevTools.js). Dev-only; no effect on
// production (the dev indicator never renders in production anyway).
const cleanUi = process.env.NEXT_PUBLIC_CLEAN_UI === 'true';

const nextConfig = {
  ...(cleanUi ? { devIndicators: false } : {}),
  // Dev-only: let tunnel hosts (ngrok/zrok) reach Next's dev resources (HMR +
  // proxied /api). Wildcards cover the changing subdomain. Ignored in production
  // builds, so this has no effect on prod. Add more via ALLOWED_DEV_ORIGINS.
  allowedDevOrigins: [
    '*.zrok.io',
    '*.share.zrok.io',
    '*.shares.zrok.io',
    '*.ngrok-free.app',
    '*.ngrok.app',
    '*.ngrok.io',
    ...extraDevOrigins,
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
  // Single-origin proxy for LOCAL DEV / TUNNELS only (ngrok/zrok). It forwards
  // /api and /uploads to the backend so the whole app can be exposed through ONE
  // URL. Opt-in: it stays OFF unless BACKEND_PROXY_ORIGIN is set, so production
  // builds (which don't set it) get no rewrites and are unaffected.
  async rewrites() {
    const backendOrigin = process.env.BACKEND_PROXY_ORIGIN;
    if (!backendOrigin) return [];
    const origin = backendOrigin.replace(/\/+$/, '');
    return [
      { source: '/api/:path*', destination: `${origin}/api/:path*` },
      { source: '/uploads/:path*', destination: `${origin}/uploads/:path*` },
    ];
  },
  images: {
    remotePatterns: buildImageRemotePatterns(),
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [48, 64, 96, 160, 240, 320, 480, 640],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    unoptimized: false,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000',
    NEXT_PUBLIC_CDN_BASE_URL: process.env.NEXT_PUBLIC_CDN_BASE_URL || '',
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || '',
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  },
};

export default nextConfig;
