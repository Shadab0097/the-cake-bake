/**
 * Format price from paise to rupees display
 * @param {number} paise - Price in paise
 * @returns {string} Formatted price like "₹699"
 */
export function formatPrice(paise) {
  if (!paise && paise !== 0) return '₹0';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format date to display string
 * @param {string|Date} date
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  if (!date) return '';
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };
  return new Date(date).toLocaleDateString('en-IN', defaultOptions);
}

/**
 * Slugify a string
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate text with ellipsis
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength).trim() + '...';
}

/**
 * Format occasion slug to display name
 * @param {string} occasion - e.g. "mothers_day"
 * @returns {string} e.g. "Mother's Day"
 */
export function formatOccasion(occasion) {
  const map = {
    birthday: 'Birthday',
    anniversary: 'Anniversary',
    wedding: 'Wedding',
    valentines: "Valentine's Day",
    mothers_day: "Mother's Day",
    fathers_day: "Father's Day",
    christmas: 'Christmas',
    new_year: 'New Year',
    diwali: 'Diwali',
    holi: 'Holi',
    eid: 'Eid',
    rakhi: 'Rakhi',
    graduation: 'Graduation',
    baby_shower: 'Baby Shower',
    engagement: 'Engagement',
    farewell: 'Farewell',
    thank_you: 'Thank You',
    get_well: 'Get Well Soon',
    congratulations: 'Congratulations',
    corporate: 'Corporate',
  };
  return map[occasion] || occasion.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get star rating display
 * @param {number} rating
 * @returns {string}
 */
export function getStarDisplay(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return { full, half, empty };
}

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
export function getProductImage(product, index = 0) {
  if (product?.images?.[index]?.url) {
    const url = product.images[index].url;
    // If relative URL, prepend API base
    if (url.startsWith('/')) {
      return `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'}${url}`;
    }
    return url;
  }
  return '/images/placeholder-cake.svg';
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
  birthday: '🎂',
  anniversary: '💕',
  wedding: '💒',
  valentines: '❤️',
  mothers_day: '👩',
  fathers_day: '👨',
  christmas: '🎄',
  new_year: '🎆',
  diwali: '🪔',
  holi: '🎨',
  eid: '🌙',
  rakhi: '🎀',
  graduation: '🎓',
  baby_shower: '👶',
  engagement: '💍',
  farewell: '👋',
  thank_you: '🙏',
  get_well: '💐',
  congratulations: '🎉',
  corporate: '🏢',
};
