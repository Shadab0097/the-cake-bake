const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const metaWebhookService = require('../src/modules/chatbot/metaWebhook.service');

const sign = (body, secret) => {
  const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${digest}`;
};

test('Meta webhook signature verification accepts exact raw body bytes', () => {
  const secret = 'meta-app-secret';
  const rawBody = Buffer.from('{"entry":[{"id":"1"}],"object":"whatsapp_business_account"}');
  const signatureHeader = sign(rawBody, secret);

  assert.equal(
    metaWebhookService.verifySignature({ rawBody, signatureHeader, appSecret: secret }),
    true
  );
});

test('Meta webhook signature verification rejects missing, malformed, and mismatched signatures', () => {
  const secret = 'meta-app-secret';
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');

  assert.throws(
    () => metaWebhookService.verifySignature({ rawBody, signatureHeader: undefined, appSecret: secret }),
    { statusCode: 401 }
  );

  assert.throws(
    () => metaWebhookService.verifySignature({ rawBody, signatureHeader: 'sha1=abc', appSecret: secret }),
    { statusCode: 401 }
  );

  assert.throws(
    () => metaWebhookService.verifySignature({
      rawBody,
      signatureHeader: sign(Buffer.from('{"object":"tampered"}'), secret),
      appSecret: secret,
    }),
    { statusCode: 401 }
  );
});

test('Meta webhook signature verification fails closed when app secret is missing', () => {
  const rawBody = Buffer.from('{"object":"whatsapp_business_account"}');

  assert.throws(
    () => metaWebhookService.verifySignature({
      rawBody,
      signatureHeader: sign(rawBody, 'real-secret'),
      appSecret: '',
    }),
    { statusCode: 500 }
  );
});

test('Meta webhook JSON parsing only runs after signature and rejects invalid payloads', () => {
  const rawBody = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
  const parsed = metaWebhookService.parseJsonBody(rawBody);

  assert.equal(parsed.object, 'whatsapp_business_account');
  assert.deepEqual(parsed.entry, []);

  assert.throws(
    () => metaWebhookService.parseJsonBody(Buffer.from('{bad-json')),
    { statusCode: 400 }
  );

  assert.throws(
    () => metaWebhookService.parseJsonBody({ object: 'already-parsed' }),
    { statusCode: 400 }
  );
});
