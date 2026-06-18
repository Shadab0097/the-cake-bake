const test = require('node:test');
const assert = require('node:assert/strict');

const ApiError = require('../src/utils/ApiError');
const errorHandler = require('../src/middleware/errorHandler');
const validate = require('../src/middleware/validate');

// Minimal Express res mock capturing status + json payload.
const mockRes = () => {
  const res = { statusCode: 0, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};

const mockReq = (overrides = {}) => ({
  originalUrl: '/test',
  method: 'POST',
  ip: '127.0.0.1',
  headers: {},
  ...overrides,
});

test('ApiError factories default to a stable status-based code', () => {
  assert.equal(ApiError.badRequest('x').code, 'BAD_REQUEST');
  assert.equal(ApiError.unauthorized('x').code, 'UNAUTHORIZED');
  assert.equal(ApiError.forbidden('x').code, 'FORBIDDEN');
  assert.equal(ApiError.notFound('x').code, 'NOT_FOUND');
  assert.equal(ApiError.conflict('x').code, 'CONFLICT');
  assert.equal(ApiError.tooMany('x').code, 'TOO_MANY_REQUESTS');
  assert.equal(ApiError.internal('x').code, 'INTERNAL_ERROR');
});

test('ApiError honors an explicit semantic code and field errors', () => {
  const err = ApiError.badRequest(
    'Insufficient stock',
    [{ field: 'quantity', code: 'INSUFFICIENT_STOCK', message: 'Insufficient stock' }],
    'INSUFFICIENT_STOCK'
  );
  assert.equal(err.code, 'INSUFFICIENT_STOCK');
  assert.equal(err.errors[0].field, 'quantity');
  assert.equal(err.errors[0].code, 'INSUFFICIENT_STOCK');
});

test('errorHandler emits top-level code and backfills missing entry codes', () => {
  const res = mockRes();
  const err = ApiError.badRequest('Bad thing', [{ field: 'name', message: 'is required' }], 'CUSTOM_CODE');
  errorHandler(err, mockReq(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'CUSTOM_CODE');
  assert.equal(res.body.message, 'Bad thing');
  // Entry lacked a code, so it is backfilled with the top-level code.
  assert.equal(res.body.errors[0].code, 'CUSTOM_CODE');
});

test('errorHandler maps Mongoose duplicate key errors to DUPLICATE_VALUE', () => {
  const res = mockRes();
  const dupErr = Object.assign(new Error('E11000'), { code: 11000, keyValue: { email: 'a@b.com' } });
  errorHandler(dupErr, mockReq(), res, () => {});

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'DUPLICATE_VALUE');
  assert.equal(res.body.errors[0].field, 'email');
  assert.equal(res.body.errors[0].code, 'DUPLICATE_VALUE');
});

test('errorHandler maps Mongoose CastError to INVALID_IDENTIFIER', () => {
  const res = mockRes();
  const castErr = Object.assign(new Error('cast'), { name: 'CastError', path: 'id', value: 'bad' });
  errorHandler(castErr, mockReq(), res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'INVALID_IDENTIFIER');
  assert.equal(res.body.errors[0].field, 'id');
});

test('validate middleware emits per-field codes and a specific umbrella message', () => {
  // Tiny Joi-compatible stub: required string `name`.
  const schema = {
    body: {
      validate() {
        return {
          error: {
            details: [
              { path: ['name'], type: 'any.required', message: '"name" is required' },
              { path: ['age'], type: 'number.base', message: '"age" must be a number' },
            ],
          },
        };
      },
    },
  };

  let captured = null;
  validate(schema)(mockReq({ body: {} }), mockRes(), (err) => { captured = err; });

  assert.ok(captured instanceof ApiError);
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.code, 'VALIDATION_ERROR');
  // Umbrella reflects the real first error rather than a generic string.
  assert.match(captured.message, /name is required/);
  assert.match(captured.message, /1 more validation issue/);
  assert.equal(captured.errors[0].code, 'ANY_REQUIRED');
  assert.equal(captured.errors[1].code, 'NUMBER_BASE');
});

test('validate middleware passes through and sanitizes valid input', () => {
  const schema = {
    body: {
      validate() {
        return { value: { name: 'cake', extra: undefined } };
      },
    },
  };
  const req = mockReq({ body: { name: 'cake' } });
  let nextErr = 'untouched';
  validate(schema)(req, mockRes(), (err) => { nextErr = err; });

  assert.equal(nextErr, undefined);
  assert.deepEqual(req.body, { name: 'cake', extra: undefined });
});
