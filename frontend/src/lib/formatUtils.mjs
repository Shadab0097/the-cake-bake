const RUPEE_SYMBOL = '\u20b9';

const OCCASION_LABELS = Object.freeze({
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
});

export function formatPrice(paise) {
  const amount = Number(paise);
  if (!Number.isFinite(amount)) return `${RUPEE_SYMBOL}0`;

  const rupees = amount / 100;
  return `${RUPEE_SYMBOL}${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

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

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength).trim()}...`;
}

export function formatOccasion(occasion) {
  if (!occasion) return '';
  return OCCASION_LABELS[occasion] || occasion.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function getStarDisplay(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(safeRating);
  const half = safeRating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return { full, half, empty };
}
