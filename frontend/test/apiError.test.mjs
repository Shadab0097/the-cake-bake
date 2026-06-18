import test from 'node:test';
import assert from 'node:assert/strict';

import {
  humanizeField,
  getApiErrorCode,
  getApiFieldErrors,
  getApiErrorMessage,
  extractApiError,
  API_ERROR_MESSAGES,
} from '../src/lib/apiError.mjs';

test('humanizeField turns field paths into readable labels', () => {
  assert.equal(humanizeField('shippingAddress.pincode'), 'Pincode');
  assert.equal(humanizeField('addressLine1'), 'Address Line 1');
  assert.equal(humanizeField('guestInfo.email'), 'Email');
  assert.equal(humanizeField('phone'), 'Phone');
});

test('getApiErrorMessage prefers the specific field-level message', () => {
  const err = {
    response: {
      status: 400,
      data: {
        code: 'INSUFFICIENT_STOCK',
        message: 'Insufficient stock',
        errors: [{ field: 'quantity', code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock' }],
      },
    },
  };
  assert.equal(getApiErrorMessage(err), 'Quantity: Insufficient stock');
  assert.equal(getApiErrorCode(err), 'INSUFFICIENT_STOCK');
});

test('getApiErrorMessage humanizes embedded field paths in validation messages', () => {
  const err = {
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_ERROR',
        message: 'shippingAddress.pincode must be a 6 digit number',
        errors: [{ field: 'shippingAddress.pincode', code: 'STRING_PATTERN', message: 'shippingAddress.pincode must be a 6 digit number' }],
      },
    },
  };
  // Leading path replaced by the human label, no duplicate prefix.
  assert.equal(getApiErrorMessage(err), 'Pincode must be a 6 digit number');
});

test('getApiErrorMessage falls back to the umbrella message when no field errors', () => {
  const err = {
    response: {
      status: 400,
      data: { code: 'CART_EMPTY', message: 'Cart is empty' },
    },
  };
  assert.equal(getApiErrorMessage(err), 'Cart is empty');
});

test('getApiErrorMessage hides raw server errors behind friendly copy', () => {
  const err = { response: { status: 500, data: { code: 'INTERNAL_ERROR', message: 'TypeError: x is undefined' } } };
  assert.equal(getApiErrorMessage(err), API_ERROR_MESSAGES.SERVER_MESSAGE);
});

test('getApiErrorMessage handles network and timeout errors', () => {
  assert.equal(getApiErrorMessage({ request: {}, message: 'Network Error' }), API_ERROR_MESSAGES.NETWORK_MESSAGE);
  assert.equal(getApiErrorMessage({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' }), API_ERROR_MESSAGES.TIMEOUT_MESSAGE);
});

test('getApiErrorMessage uses friendly rate-limit copy only without a specific message', () => {
  const withMsg = { response: { status: 429, data: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again in 5 minutes.' } } };
  assert.equal(getApiErrorMessage(withMsg), 'Too many login attempts. Try again in 5 minutes.');
  const withoutMsg = { response: { status: 429, data: { code: 'TOO_MANY_REQUESTS' } } };
  assert.equal(getApiErrorMessage(withoutMsg), API_ERROR_MESSAGES.RATE_LIMIT_MESSAGE);
});

test('getApiFieldErrors builds a humanized field -> message map', () => {
  const err = {
    response: {
      data: {
        errors: [
          { field: 'guestInfo.email', message: 'guestInfo.email must be a valid email' },
          { field: 'phone', message: 'phone is required' },
        ],
      },
    },
  };
  assert.deepEqual(getApiFieldErrors(err), {
    'guestInfo.email': 'Email must be a valid email',
    phone: 'Phone is required',
  });
});

test('extractApiError bundles message, code, and field errors', () => {
  const err = {
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_ERROR',
        message: 'phone is required',
        errors: [{ field: 'phone', code: 'ANY_REQUIRED', message: 'phone is required' }],
      },
    },
  };
  const result = extractApiError(err, 'Could not submit');
  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(result.message, 'Phone is required');
  assert.deepEqual(result.fieldErrors, { phone: 'Phone is required' });
});

test('getApiErrorMessage uses the provided fallback as a last resort', () => {
  assert.equal(getApiErrorMessage({ response: { status: 400, data: {} } }, 'Could not save'), 'Could not save');
});
