import test from 'node:test';
import assert from 'node:assert/strict';

import nextConfig, { buildImageRemotePatterns } from '../next.config.mjs';

test('Next image config includes production API, custom CDN, and Cloudinary hosts', () => {
  const patterns = buildImageRemotePatterns({
    NEXT_PUBLIC_API_URL: 'https://api.example.com/api/v1',
    NEXT_PUBLIC_API_BASE: 'https://assets.example.com',
    NEXT_PUBLIC_CDN_BASE_URL: 'https://static.example.com',
    NEXT_PUBLIC_IMAGE_DOMAINS: 'cdn.example.com,https://media.example.com',
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'cakecloud',
  });

  assert.equal(patterns.some((pattern) => pattern.hostname === 'api.thecakebake.in'), true);
  assert.equal(patterns.some((pattern) => pattern.hostname === 'api.example.com'), true);
  assert.equal(patterns.some((pattern) => pattern.hostname === 'assets.example.com'), true);
  assert.equal(patterns.some((pattern) => pattern.hostname === 'static.example.com'), true);
  assert.equal(patterns.some((pattern) => pattern.hostname === 'cdn.example.com'), true);
  assert.equal(patterns.some((pattern) => pattern.hostname === 'media.example.com'), true);
  assert.equal(patterns.some((pattern) => (
    pattern.hostname === 'res.cloudinary.com' &&
    pattern.pathname === '/cakecloud/image/upload/**'
  )), true);
});

test('CDN base URLs with path prefixes keep their upload pathname scope', () => {
  const patterns = buildImageRemotePatterns({
    NEXT_PUBLIC_CDN_BASE_URL: 'https://cdn.example.com/cake-assets',
  });

  assert.equal(patterns.some((pattern) => (
    pattern.hostname === 'cdn.example.com' &&
    pattern.pathname === '/cake-assets/uploads/**'
  )), true);
});

test('Next image optimizer is configured for modern formats and long cache TTL', () => {
  assert.deepEqual(nextConfig.images.formats, ['image/avif', 'image/webp']);
  assert.equal(nextConfig.images.minimumCacheTTL, 60 * 60 * 24 * 30);
  assert.equal(nextConfig.images.remotePatterns.some((pattern) => (
    pattern.hostname === 'localhost' &&
    pattern.port === '5000' &&
    pattern.pathname === '/uploads/**'
  )), true);
  assert.equal(nextConfig.images.remotePatterns.some((pattern) => pattern.hostname === 'res.cloudinary.com'), true);
});
