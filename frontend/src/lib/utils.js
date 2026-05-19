import {
  getBannerImageUrl,
  getCategoryImageUrl,
  getOptimizedImageUrl,
  getProductImageUrl,
  resolveMediaUrl,
} from './imageUtils.mjs';
import {
  formatDate,
  formatOccasion,
  formatPrice,
  getStarDisplay,
  slugify,
  truncate,
} from './formatUtils.mjs';

export {
  formatDate,
  formatOccasion,
  formatPrice,
  getBannerImageUrl,
  getCategoryImageUrl,
  getOptimizedImageUrl,
  getStarDisplay,
  resolveMediaUrl,
  slugify,
  truncate,
};

/**
 * Debounce function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate product image URL or placeholder
 */
export function getProductImage(product, index = 0, preset = 'productCard') {
  return getProductImageUrl(product, index, preset);
}

/**
 * OCCASIONS constant (mirrors backend)
 */
export const OCCASIONS = [
  'birthday', 'anniversary', 'wedding', 'valentines',
  'mothers_day', 'fathers_day', 'christmas', 'new_year',
  'diwali', 'holi', 'eid', 'rakhi', 'graduation',
  'baby_shower', 'engagement', 'farewell', 'thank_you',
  'get_well', 'congratulations', 'corporate',
];

/**
 * Occasion emoji map
 */
export const OCCASION_EMOJIS = {
  birthday: '\u{1F382}',
  anniversary: '\u{1F495}',
  wedding: '\u{1F492}',
  valentines: '\u2764\uFE0F',
  mothers_day: '\u{1F469}',
  fathers_day: '\u{1F468}',
  christmas: '\u{1F384}',
  new_year: '\u{1F386}',
  diwali: '\u{1FA94}',
  holi: '\u{1F3A8}',
  eid: '\u{1F319}',
  rakhi: '\u{1F380}',
  graduation: '\u{1F393}',
  baby_shower: '\u{1F476}',
  engagement: '\u{1F48D}',
  farewell: '\u{1F44B}',
  thank_you: '\u{1F64F}',
  get_well: '\u{1F490}',
  congratulations: '\u{1F389}',
  corporate: '\u{1F3E2}',
};
