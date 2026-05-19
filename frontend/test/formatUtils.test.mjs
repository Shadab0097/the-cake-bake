import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDate,
  formatOccasion,
  formatPrice,
  getStarDisplay,
  slugify,
  truncate,
} from '../src/lib/formatUtils.mjs';

test('formatPrice renders backend paise values as Indian rupees', () => {
  assert.equal(formatPrice(0), '\u20b90');
  assert.equal(formatPrice(69900), '\u20b9699');
  assert.equal(formatPrice(12345678), '\u20b91,23,456.78');
  assert.equal(formatPrice('4900'), '\u20b949');
  assert.equal(formatPrice(undefined), '\u20b90');
});

test('formatDate keeps customer-facing dates deterministic when options are supplied', () => {
  assert.equal(
    formatDate('2026-05-19T12:00:00.000Z', { timeZone: 'UTC' }),
    '19 May 2026'
  );
  assert.equal(formatDate(null), '');
});

test('slugify strips punctuation and collapses whitespace for route-safe values', () => {
  assert.equal(slugify(' Chocolate & Truffle Cake!! '), 'chocolate-truffle-cake');
  assert.equal(slugify('custom__cake -- special'), 'custom-cake-special');
  assert.equal(slugify(null), '');
});

test('formatOccasion preserves known labels and title-cases unknown slugs', () => {
  assert.equal(formatOccasion('mothers_day'), "Mother's Day");
  assert.equal(formatOccasion('same_day_delivery'), 'Same Day Delivery');
  assert.equal(formatOccasion(''), '');
});

test('rating display is clamped to the five-star UI contract', () => {
  assert.deepEqual(getStarDisplay(4.7), { full: 4, half: 1, empty: 0 });
  assert.deepEqual(getStarDisplay(9), { full: 5, half: 0, empty: 0 });
  assert.deepEqual(getStarDisplay(-1), { full: 0, half: 0, empty: 5 });
});

test('truncate leaves short text alone and trims long text before ellipsis', () => {
  assert.equal(truncate('Chocolate cake', 100), 'Chocolate cake');
  assert.equal(truncate('Chocolate cake', 9), 'Chocolate...');
  assert.equal(truncate('', 9), '');
});
