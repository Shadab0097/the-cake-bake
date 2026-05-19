const DEFAULT_API_BASE = 'http://localhost:5000';

export const IMAGE_PRESETS = Object.freeze({
  productCard: 'c_fill,g_auto,w_640,h_640,f_auto,q_auto:good,dpr_auto',
  productDetail: 'c_fit,w_1400,h_1400,f_auto,q_auto:good,dpr_auto',
  thumbnail: 'c_fill,g_auto,w_160,h_160,f_auto,q_auto:good,dpr_auto',
  category: 'c_fill,g_auto,w_360,h_360,f_auto,q_auto:good,dpr_auto',
  bannerDesktop: 'c_fill,g_auto,w_1920,h_720,f_auto,q_auto:good,dpr_auto',
  bannerMobile: 'c_fill,g_auto,w_900,h_900,f_auto,q_auto:good,dpr_auto',
  addon: 'c_fill,g_auto,w_160,h_160,f_auto,q_auto:good,dpr_auto',
});

export const PLACEHOLDER_CAKE_IMAGE = '/images/placeholder-cake.svg';

export const getMediaBase = (env = process.env) => (
  env.NEXT_PUBLIC_CDN_BASE_URL || env.NEXT_PUBLIC_API_BASE || DEFAULT_API_BASE
);

export const getApiBase = (env = process.env) => (
  getMediaBase(env)
);

export const resolveMediaUrl = (url, { apiBase = getMediaBase() } = {}) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/images/')) return trimmed;
  if (trimmed.startsWith('/')) return `${apiBase.replace(/\/+$/, '')}${trimmed}`;
  return trimmed;
};

export const isCloudinaryImage = (url) => (
  typeof url === 'string' &&
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)
);

export const addCloudinaryTransformation = (url, transformation) => {
  if (!isCloudinaryImage(url) || !transformation) return url;

  const marker = '/image/upload/';
  const index = url.indexOf(marker);
  if (index < 0) return url;

  const prefix = url.slice(0, index + marker.length);
  const suffix = url.slice(index + marker.length).replace(/^\/+/, '');
  if (suffix.startsWith(`${transformation}/`)) return url;
  return `${prefix}${transformation}/${suffix}`;
};

export const getOptimizedImageUrl = (url, preset = 'productCard', options = {}) => {
  const resolved = resolveMediaUrl(url, options);
  if (!resolved) return '';

  const transformation = IMAGE_PRESETS[preset] || preset;
  return addCloudinaryTransformation(resolved, transformation);
};

export const getProductImageUrl = (product, index = 0, preset = 'productCard', options = {}) => {
  const url = product?.images?.[index]?.url;
  return getOptimizedImageUrl(url, preset, options) || PLACEHOLDER_CAKE_IMAGE;
};

export const getCategoryImageUrl = (category, preset = 'category', options = {}) => (
  getOptimizedImageUrl(category?.image, preset, options)
);

export const getBannerImageUrl = (banner, preset = 'bannerDesktop', options = {}) => {
  const source = preset === 'bannerMobile'
    ? (banner?.image?.mobile || banner?.image?.desktop)
    : (banner?.image?.desktop || banner?.image?.mobile);
  return getOptimizedImageUrl(source, preset, options);
};
