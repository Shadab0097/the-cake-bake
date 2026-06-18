const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CodAbuseService,
  buildAddressHash,
  isSuspiciousPhone,
  normalizeEmail,
  normalizePhone,
} = require('../src/modules/orders/codAbuse.service');

const baseConfig = {
  enabled: true,
  maxOrderAmount: 500000,
  reviewOrderAmount: 250000,
  phoneOrderLimit: 5,
  phoneOrderWindowHours: 24,
  guestIpOrderLimit: 3,
  guestIpOrderWindowHours: 1,
  addressCancelLimit: 3,
  addressCancelWindowDays: 30,
  disposableEmailDomains: ['mailinator.com', 'tempmail.com'],
};

const baseAddress = {
  phone: '+91 98765 01234',
  addressLine1: '12 Cake Street',
  addressLine2: 'Near Bakery',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
};

const fakeUserModel = (user = null) => ({
  findById() {
    return {
      select() {
        return {
          lean: async () => user,
        };
      },
    };
  },
});

const serviceWithCounts = ({ counts = [], user = null, alerts = [] } = {}) => {
  let index = 0;
  return new CodAbuseService({
    config: baseConfig,
    UserModel: fakeUserModel(user),
    OrderModel: {
      countDocuments: async () => counts[index++] || 0,
    },
    operationalAlertService: {
      recordAlert: async (alert) => {
        alerts.push(alert);
      },
    },
  });
};

test('COD risk normalization is stable and catches obvious fake phones', () => {
  assert.equal(normalizePhone('+91 98765 01234'), '9876501234');
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com');
  assert.equal(isSuspiciousPhone('9999999999'), true);
  assert.equal(isSuspiciousPhone('1234567890'), true);
  assert.equal(isSuspiciousPhone('9876543210'), true);
  assert.equal(isSuspiciousPhone('9876501234'), false);
  assert.equal(buildAddressHash(baseAddress), buildAddressHash({
    ...baseAddress,
    addressLine1: '12   Cake Street',
    city: 'mumbai',
  }));
});

test('COD assessment allows normal orders and flags high value orders for review', async () => {
  const alerts = [];
  const service = serviceWithCounts({ counts: [0, 0], alerts });

  const normal = await service.assertCanUseCOD({
    shippingAddress: baseAddress,
    total: 120000,
    requestContext: { ip: '203.0.113.10' },
  });
  assert.equal(normal.allowed, true);
  assert.equal(normal.decision, 'allow');
  assert.equal(alerts.length, 0);

  const review = await service.assertCanUseCOD({
    shippingAddress: baseAddress,
    total: 300000,
    requestContext: { ip: '203.0.113.10' },
  });
  assert.equal(review.allowed, true);
  assert.equal(review.decision, 'review');
  assert.deepEqual(review.flags, ['high_value_cod']);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, 'warning');
});

test('COD assessment blocks orders above configured COD amount', async () => {
  const alerts = [];
  const service = serviceWithCounts({ counts: [0, 0], alerts });

  await assert.rejects(
    () => service.assertCanUseCOD({
      shippingAddress: baseAddress,
      total: 600000,
      requestContext: { ip: '203.0.113.10' },
    }),
    { statusCode: 400 }
  );
  assert.equal(alerts[0].severity, 'critical');
  assert.equal(alerts[0].metadata.flags.includes('cod_amount_too_high'), true);
});

test('COD assessment blocks phone and guest IP velocity abuse', async () => {
  const phoneVelocityService = serviceWithCounts({ counts: [5, 0] });
  await assert.rejects(
    () => phoneVelocityService.assertCanUseCOD({
      shippingAddress: baseAddress,
      total: 100000,
      requestContext: { ip: '203.0.113.10' },
    }),
    { statusCode: 429 }
  );

  const guestIpVelocityService = serviceWithCounts({ counts: [0, 3, 0] });
  await assert.rejects(
    () => guestIpVelocityService.assertCanUseCOD({
      guestInfo: { email: 'guest@example.com', phone: baseAddress.phone },
      shippingAddress: baseAddress,
      total: 100000,
      isGuest: true,
      requestContext: { ip: '203.0.113.10' },
    }),
    { statusCode: 429 }
  );
});

test('COD assessment blocks disabled users and disposable guest emails', async () => {
  const disabledUserService = serviceWithCounts({
    user: { email: 'customer@example.com', phone: '9876501234', codDisabled: true },
  });
  await assert.rejects(
    () => disabledUserService.assertCanUseCOD({
      userId: 'user-id',
      shippingAddress: baseAddress,
      total: 100000,
    }),
    /unavailable for this account/
  );

  const disposableEmailService = serviceWithCounts({ counts: [0, 0] });
  await assert.rejects(
    () => disposableEmailService.assertCanUseCOD({
      guestInfo: { email: 'fake@mailinator.com', phone: baseAddress.phone },
      shippingAddress: baseAddress,
      total: 100000,
      isGuest: true,
    }),
    /temporary or disposable email/
  );
});

test('COD assessment blocks addresses with repeated COD cancellations', async () => {
  const service = serviceWithCounts({ counts: [0, 3] });

  await assert.rejects(
    () => service.assertCanUseCOD({
      shippingAddress: baseAddress,
      total: 100000,
      requestContext: { ip: '203.0.113.10' },
    }),
    /repeated COD cancellations at this address/
  );
});


test('COD block surfaces the specific cause and a structured error payload', async () => {
  const service = serviceWithCounts({ counts: [0, 0] });

  await assert.rejects(
    () => service.assertCanUseCOD({
      guestInfo: { email: 'guest@example.com', phone: '9876543210' },
      shippingAddress: { ...baseAddress, phone: '9876543210' },
      total: 100000,
      isGuest: true,
      requestContext: { ip: '203.0.113.10' },
    }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /valid mobile number/);
      assert.equal(err.errors.length, 1);
      assert.equal(err.errors[0].field, 'phone');
      assert.equal(err.errors[0].code, 'invalid_phone');
      return true;
    }
  );
});
