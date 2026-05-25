const test = require('node:test');
const assert = require('node:assert/strict');

const { quoteTokenHash, toPaise } = require('../src/modules/inquiries/inquiryQuote.service');

test('quote token hashing is deterministic and does not expose the raw token', () => {
  const token = 'quote-token-example';
  const hash = quoteTokenHash(token);

  assert.equal(hash, quoteTokenHash(token));
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64);
});

test('quote rupee amount is stored as paise', () => {
  assert.equal(toPaise(2500), 250000);
  assert.equal(toPaise('1499.50'), 149950);
});
