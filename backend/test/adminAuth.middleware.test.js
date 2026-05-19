const test = require('node:test');
const assert = require('node:assert/strict');

const { adminAuth, superAdminAuth } = require('../src/middleware/adminAuth');
const { USER_ROLES } = require('../src/utils/constants');

const runMiddleware = (middleware, req = {}) => new Promise((resolve) => {
  middleware(req, {}, (error) => resolve(error || null));
});

test('adminAuth rejects unauthenticated and customer users', async () => {
  const missingUserError = await runMiddleware(adminAuth, {});
  assert.equal(missingUserError.statusCode, 401);

  const customerError = await runMiddleware(adminAuth, { user: { role: USER_ROLES.CUSTOMER } });
  assert.equal(customerError.statusCode, 403);
});

test('adminAuth allows admin and superadmin users', async () => {
  assert.equal(await runMiddleware(adminAuth, { user: { role: USER_ROLES.ADMIN } }), null);
  assert.equal(await runMiddleware(adminAuth, { user: { role: USER_ROLES.SUPERADMIN } }), null);
});

test('superAdminAuth only allows superadmin users', async () => {
  const adminError = await runMiddleware(superAdminAuth, { user: { role: USER_ROLES.ADMIN } });

  assert.equal(adminError.statusCode, 403);
  assert.equal(await runMiddleware(superAdminAuth, { user: { role: USER_ROLES.SUPERADMIN } }), null);
});
