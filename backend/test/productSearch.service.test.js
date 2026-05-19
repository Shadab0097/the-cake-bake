const test = require('node:test');
const assert = require('node:assert/strict');

const productService = require('../src/modules/products/product.service');

const {
  buildProductFilter,
  buildProductSort,
  parsePriceBound,
  sanitizeFilterValue,
  sanitizeSearchTerm,
} = productService;

test('product search sanitizer removes unsafe operators and caps search length', () => {
  const term = sanitizeSearchTerm(' <script>$where chocolate & cream</script> '.repeat(5));

  assert.equal(/[<>$&]/.test(term), false);
  assert.equal(term.length <= 80, true);
  assert.equal(term.includes('chocolate'), true);
  assert.equal(sanitizeSearchTerm('  red   velvet-cake  '), 'red velvet-cake');
});

test('product facet sanitizer trims controls without creating Mongo operators', () => {
  assert.equal(sanitizeFilterValue(' Mumbai\r\n'), 'Mumbai');
  assert.equal(sanitizeFilterValue({ $ne: 'cake' }), '[object Object]');
  assert.equal(sanitizeFilterValue(null), '');
});

test('price bounds accept non-negative integers and ignore invalid values', () => {
  assert.equal(parsePriceBound('0'), 0);
  assert.equal(parsePriceBound('129900'), 129900);
  assert.equal(parsePriceBound('-1'), undefined);
  assert.equal(parsePriceBound('abc'), undefined);
  assert.equal(parsePriceBound(''), undefined);
});

test('product filter builds text, facet, price, and availability constraints safely', () => {
  const productIds = ['product-a', 'product-b'];
  const { filter, searchTerm } = buildProductFilter({
    q: ' chocolate cake ',
    category: ' category-id ',
    flavor: ' chocolate ',
    occasion: 'birthday',
    city: 'Mumbai',
    minPrice: '50000',
    maxPrice: '150000',
    tags: 'bestseller',
    isEggless: 'true',
    hasEgglessOption: 'true',
  }, {
    includeTextSearch: true,
    productIds,
  });

  assert.equal(searchTerm, 'chocolate cake');
  assert.deepEqual(filter.$text, { $search: 'chocolate cake' });
  assert.equal(filter.category, 'category-id');
  assert.equal(filter.flavors, 'chocolate');
  assert.equal(filter.occasions, 'birthday');
  assert.equal(filter.cities, 'Mumbai');
  assert.equal(filter.tags, 'bestseller');
  assert.equal(filter.isEggless, true);
  assert.equal(filter.hasEgglessOption, true);
  assert.deepEqual(filter.basePrice, { $gte: 50000, $lte: 150000 });
  assert.deepEqual(filter._id, { $in: productIds });
});

test('product filter does not add text search unless the caller opts in', () => {
  const { filter } = buildProductFilter({ q: 'chocolate' });

  assert.equal(filter.$text, undefined);
  assert.deepEqual(filter, { isActive: true });
});

test('product sort defaults to text score only for text searches and honors explicit sort', () => {
  assert.deepEqual(buildProductSort(undefined, true), { score: { $meta: 'textScore' } });
  assert.deepEqual(buildProductSort(undefined, false), { sortOrder: 1, createdAt: -1 });
  assert.deepEqual(buildProductSort('price_asc', true), { basePrice: 1 });
  assert.deepEqual(buildProductSort('price_desc'), { basePrice: -1 });
  assert.deepEqual(buildProductSort('rating'), { averageRating: -1 });
});
