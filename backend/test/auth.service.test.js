const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'auth-service-test-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'auth-refresh-test-secret';

const authService = require('../src/modules/auth/auth.service');
const { USER_ROLES } = require('../src/utils/constants');
const { ADMIN_ROLES } = require('../src/utils/adminAccess');

test('refresh token hashes are deterministic and never equal the raw token', () => {
  const rawToken = 'raw-refresh-token';
  const hash = authService.hashRefreshToken(rawToken);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, authService.hashRefreshToken(rawToken));
  assert.notEqual(hash, rawToken);
});

test('customer and admin refresh cookies are separated and HttpOnly', () => {
  const customerCookie = authService.getRefreshCookieName('customer');
  const adminCookie = authService.getRefreshCookieName('admin');
  const options = authService.getRefreshCookieOptions();

  assert.notEqual(customerCookie, adminCookie);
  assert.equal(options.httpOnly, true);
  assert.equal(options.path, '/api/v1/auth');
  assert.equal(typeof options.maxAge, 'number');
  assert.ok(options.maxAge > 0);
});

test('refresh token request lookup prefers the scoped HttpOnly cookie', () => {
  const customerCookie = authService.getRefreshCookieName('customer');
  const adminCookie = authService.getRefreshCookieName('admin');

  const req = {
    cookies: {
      [customerCookie]: 'customer-cookie-token',
      [adminCookie]: 'admin-cookie-token',
    },
    body: {
      refreshToken: 'legacy-body-token',
    },
  };

  assert.equal(authService.getRefreshTokenFromRequest(req, 'customer'), 'customer-cookie-token');
  assert.equal(authService.getRefreshTokenFromRequest(req, 'admin'), 'admin-cookie-token');
});

test('auth responses do not expose refresh tokens to JavaScript', () => {
  const response = authService.buildAuthResponse({
    user: { _id: 'user-id' },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    refreshScope: 'customer',
  });

  assert.deepEqual(response, {
    user: { _id: 'user-id' },
    accessToken: 'access-token',
  });
});

test('generated refresh tokens are scope-bound and unique per rotation', () => {
  const user = {
    _id: '665f00000000000000000999',
    role: 'customer',
  };

  const first = authService.generateTokens(user, 'customer');
  const second = authService.generateTokens(user, 'customer');
  const decoded = jwt.verify(first.refreshToken, process.env.JWT_REFRESH_SECRET);
  const admin = authService.generateTokens({ _id: user._id, role: 'admin' }, 'admin');
  const decodedAdmin = jwt.verify(admin.refreshToken, process.env.JWT_REFRESH_SECRET);

  assert.notEqual(first.refreshToken, second.refreshToken);
  assert.equal(decoded.scope, 'customer');
  assert.equal(decoded.id, user._id);
  assert.ok(decoded.jti);
  assert.equal(decodedAdmin.scope, 'admin');
  assert.ok(decodedAdmin.jti);
});

test('admin login gate admits EVERY admin-tier role (incl. branch admin), not just admin/superadmin', () => {
  // Regression guard: the login gate must accept the same set as the adminAuth
  // middleware (ADMIN_ROLES) — branchadmin/manager/staff were once locked out.
  for (const role of ADMIN_ROLES) {
    assert.equal(authService.isAdminUser({ role }), true, `${role} should pass the admin login gate`);
  }
  assert.equal(authService.isAdminUser({ role: USER_ROLES.BRANCHADMIN }), true);
  assert.equal(authService.isAdminUser({ role: USER_ROLES.MANAGER }), true);
  assert.equal(authService.isAdminUser({ role: USER_ROLES.STAFF }), true);
});

test('admin login gate rejects customers and unknown/empty roles', () => {
  assert.equal(authService.isAdminUser({ role: USER_ROLES.CUSTOMER }), false);
  assert.equal(authService.isAdminUser({ role: 'nonsense' }), false);
  assert.equal(authService.isAdminUser({}), false);
  assert.equal(authService.isAdminUser(null), false);
});
