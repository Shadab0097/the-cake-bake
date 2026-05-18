const test = require('node:test');
const assert = require('node:assert/strict');

const authSecurityService = require('../src/modules/auth/authSecurity.service');

test('admin login detection is scope based', () => {
  assert.equal(authSecurityService.isAdminLoginRequest({ scope: 'admin' }), true);
  assert.equal(authSecurityService.isAdminLoginRequest({ scope: 'customer' }), false);
  assert.equal(authSecurityService.isAdminLoginRequest({}), false);
});

test('security event builder sanitizes request metadata and secrets', () => {
  const event = authSecurityService.buildEvent({
    type: 'admin_login_failed',
    severity: 'warning',
    req: {
      id: 'req-123',
      ip: '10.0.0.1',
      headers: {
        'user-agent': 'Browser\nInjected',
      },
      body: {
        email: ' Admin@Example.COM ',
      },
    },
    reason: 'Invalid\npassword',
    metadata: {
      password: 'secret',
      refreshToken: 'refresh-secret',
      statusCode: 401,
    },
  });

  assert.equal(event.email, 'admin@example.com');
  assert.equal(event.ip, '10.0.0.1');
  assert.equal(event.userAgent, 'Browser Injected');
  assert.equal(event.reason, 'Invalid password');
  assert.equal(event.requestId, 'req-123');
  assert.equal(event.metadata.statusCode, 401);
  assert.equal(Object.hasOwn(event.metadata, 'password'), false);
  assert.equal(Object.hasOwn(event.metadata, 'refreshToken'), false);
});

test('client IP prefers first x-forwarded-for address', () => {
  const ip = authSecurityService.getClientIp({
    ip: '10.0.0.2',
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    },
  });

  assert.equal(ip, '203.0.113.10');
});
