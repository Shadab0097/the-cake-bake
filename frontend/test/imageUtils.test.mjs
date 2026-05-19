import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addCloudinaryTransformation,
  getBannerImageUrl,
  getCategoryImageUrl,
  getMediaBase,
  getOptimizedImageUrl,
  getProductImageUrl,
  resolveMediaUrl,
} from '../src/lib/imageUtils.mjs';

const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1700000000/the-cake-bake/products/chocolate.jpg';

test('media URLs resolve API-relative uploads and keep local placeholders local', () => {
  assert.equal(
    getMediaBase({
      NEXT_PUBLIC_CDN_BASE_URL: 'https://cdn.example.com',
      NEXT_PUBLIC_API_BASE: 'https://api.example.com',
    }),
    'https://cdn.example.com'
  );
  assert.equal(
    resolveMediaUrl('/uploads/cake.jpg', { apiBase: 'https://api.example.com' }),
    'https://api.example.com/uploads/cake.jpg'
  );
  assert.equal(resolveMediaUrl('/images/placeholder-cake.svg'), '/images/placeholder-cake.svg');
  assert.equal(resolveMediaUrl('//cdn.example.com/cake.jpg'), 'https://cdn.example.com/cake.jpg');
});

test('Cloudinary transformations are inserted once for optimized delivery', () => {
  const transformed = addCloudinaryTransformation(cloudinaryUrl, 'c_fill,w_160,h_160,f_auto,q_auto');

  assert.equal(
    transformed,
    'https://res.cloudinary.com/demo/image/upload/c_fill,w_160,h_160,f_auto,q_auto/v1700000000/the-cake-bake/products/chocolate.jpg'
  );
  assert.equal(
    addCloudinaryTransformation(transformed, 'c_fill,w_160,h_160,f_auto,q_auto'),
    transformed
  );
});

test('product, category, and banner helpers apply context-specific presets', () => {
  const productUrl = getProductImageUrl({ images: [{ url: cloudinaryUrl }] }, 0, 'thumbnail');
  const categoryUrl = getCategoryImageUrl({ image: cloudinaryUrl }, 'category');
  const bannerUrl = getBannerImageUrl({ image: { desktop: cloudinaryUrl } }, 'bannerDesktop');

  assert.match(productUrl, /w_160,h_160/);
  assert.match(categoryUrl, /w_360,h_360/);
  assert.match(bannerUrl, /w_1920,h_720/);
  assert.match(getProductImageUrl({}, 0, 'thumbnail'), /placeholder-cake\.svg$/);
});

test('non-Cloudinary images are resolved but not rewritten', () => {
  assert.equal(
    getOptimizedImageUrl('/uploads/local.jpg', 'thumbnail', { apiBase: 'https://api.example.com' }),
    'https://api.example.com/uploads/local.jpg'
  );
});
