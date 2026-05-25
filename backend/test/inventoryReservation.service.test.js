const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReservationItems, hasReservableItems } = require('../src/modules/orders/inventoryReservation.service');

test('inventory reservation items include only reservable variants', () => {
  const items = buildReservationItems([
    { product: 'product-1', variant: 'variant-1', weight: '1 kg', quantity: 2 },
    { product: 'product-2', variant: null, weight: '0.5 kg', quantity: 1 },
    { variant: 'variant-3', quantity: 4 },
  ]);

  assert.deepEqual(items, [
    { product: 'product-1', variant: 'variant-1', weight: '1 kg', quantity: 2 },
    { product: null, variant: 'variant-3', weight: '', quantity: 4 },
  ]);
});

test('inventory reservation helper detects non-catalog quote items', () => {
  assert.equal(hasReservableItems([
    { product: null, variant: null, name: 'Custom Cake Quote', quantity: 1 },
  ]), false);
  assert.equal(hasReservableItems([
    { product: 'product-1', variant: 'variant-1', quantity: 1 },
  ]), true);
});
