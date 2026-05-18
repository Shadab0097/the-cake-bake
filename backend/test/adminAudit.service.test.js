const test = require('node:test');
const assert = require('node:assert/strict');

const adminAuditService = require('../src/modules/admin/adminAudit.service');

const objectId = '665f00000000000000000001';

test('admin audit entry captures actor, target, outcome, and changed fields', () => {
  const entry = adminAuditService.buildAuditEntry({
    id: 'req-abc',
    method: 'PUT',
    originalUrl: `/api/v1/admin/products/${objectId}`,
    ip: '10.0.0.5',
    headers: {
      'user-agent': 'AdminBrowser',
    },
    params: {
      id: objectId,
    },
    query: {},
    user: {
      _id: '665f00000000000000000002',
      email: 'Admin@Example.COM',
      role: 'admin',
    },
    body: {
      name: 'Chocolate Cake',
      basePrice: 50000,
      variants: [{ weight: '1kg', price: 50000, stock: 8 }],
    },
  }, {
    action: 'product.update',
    resourceType: 'product',
  }, 200);

  assert.equal(entry.action, 'product.update');
  assert.equal(entry.resourceType, 'product');
  assert.equal(String(entry.resourceId), objectId);
  assert.equal(entry.actorEmail, 'admin@example.com');
  assert.equal(entry.outcome, 'success');
  assert.equal(entry.statusCode, 200);
  assert.ok(entry.changedFields.includes('basePrice'));
  assert.ok(entry.metadata.priceOrStockFields.includes('basePrice'));
  assert.ok(entry.metadata.priceOrStockFields.includes('variants[].price'));
  assert.ok(entry.metadata.priceOrStockFields.includes('variants[].stock'));
});

test('admin audit sanitizer redacts secrets and caps bulk import payloads', () => {
  const body = adminAuditService.sanitizeBody({
    password: 'secret',
    refreshToken: 'refresh',
    products: [{ name: 'Cake 1' }, { name: 'Cake 2' }],
    nested: {
      apiKey: 'abc123',
      safe: 'value',
    },
  });

  assert.equal(body.password, '[REDACTED]');
  assert.equal(body.refreshToken, '[REDACTED]');
  assert.equal(body.nested.apiKey, '[REDACTED]');
  assert.equal(body.nested.safe, 'value');
  assert.equal(body.products, '[2 product(s)]');
});

test('admin audit entry marks failures and resolves nested target params', () => {
  const entry = adminAuditService.buildAuditEntry({
    method: 'PUT',
    originalUrl: `/api/v1/admin/products/${objectId}/variants/665f00000000000000000003`,
    headers: {},
    params: {
      id: objectId,
      vid: '665f00000000000000000003',
    },
    user: {
      _id: '665f00000000000000000002',
      role: 'superadmin',
    },
    body: {
      stock: 0,
    },
  }, {
    action: 'product.variant.update',
    resourceType: 'variant',
    resourceIdParam: 'vid',
    parentResourceIdParam: 'id',
  }, 404);

  assert.equal(entry.outcome, 'failure');
  assert.equal(String(entry.resourceId), '665f00000000000000000003');
  assert.equal(String(entry.parentResourceId), objectId);
  assert.deepEqual(entry.metadata.routeParams, {
    id: objectId,
    vid: '665f00000000000000000003',
  });
});
