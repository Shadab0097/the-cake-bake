const test = require('node:test');
const assert = require('node:assert/strict');

const { countMap } = require('../src/modules/admin/admin.service');

test('admin dashboard count map preserves expected keys and fills missing counts', () => {
  const result = countMap([
    { _id: 'pending', count: 3 },
    { _id: 'failed', count: 2 },
    { _id: '', count: 9 },
  ], ['pending', 'paid', 'failed']);

  assert.deepEqual(result, {
    pending: 3,
    paid: 0,
    failed: 2,
  });
});

test('admin dashboard count map accepts new dynamic status keys', () => {
  const result = countMap([{ _id: 'critical', count: 1 }], ['warning']);

  assert.deepEqual(result, {
    warning: 0,
    critical: 1,
  });
});
