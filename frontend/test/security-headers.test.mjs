import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  getApiOrigins,
  getOrigin,
} from '../security-headers.mjs';

const prodEnv = {
  NEXT_PUBLIC_API_URL: 'https://api.thecakebake.in/api/v1',
  NEXT_PUBLIC_API_BASE: 'https://api.thecakebake.in',
};

const headerMap = (headers) => new Map(headers.map((header) => [header.key, header.value]));

test('security headers include production hardening controls', () => {
  const headers = headerMap(buildSecurityHeaders({ env: prodEnv, nodeEnv: 'production' }));

  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.match(headers.get('Strict-Transport-Security'), /max-age=31536000/);
  assert.match(headers.get('Permissions-Policy'), /camera=\(\)/);
  assert.match(headers.get('Cross-Origin-Opener-Policy'), /same-origin-allow-popups/);
  assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
});

test('production CSP allows known ecommerce integrations without unsafe eval', () => {
  const csp = buildContentSecurityPolicy({ env: prodEnv, nodeEnv: 'production' });

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /script-src .*https:\/\/checkout\.razorpay\.com/);
  assert.match(csp, /connect-src .*https:\/\/api\.thecakebake\.in/);
  assert.match(csp, /connect-src .*https:\/\/\*\.razorpay\.com/);
  assert.match(csp, /frame-src .*https:\/\/\*\.razorpay\.com/);
  assert.match(csp, /img-src .*data: .*blob: .*https:/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.equal(csp.includes("'unsafe-eval'"), false);
});

test('development CSP keeps local API and HMR sources available', () => {
  const headers = headerMap(buildSecurityHeaders({ env: {}, nodeEnv: 'development' }));
  const csp = headers.get('Content-Security-Policy');

  assert.equal(headers.has('Strict-Transport-Security'), false);
  assert.match(csp, /script-src .*'unsafe-eval'/);
  assert.match(csp, /connect-src .*http:\/\/localhost:\*/);
  assert.match(csp, /connect-src .*ws:\/\/localhost:\*/);
  assert.equal(csp.includes('upgrade-insecure-requests'), false);
});

test('API origin extraction is explicit and deduplicated', () => {
  assert.equal(getOrigin('https://api.example.com/api/v1'), 'https://api.example.com');
  assert.equal(getOrigin('not-a-url'), null);

  assert.deepEqual(
    getApiOrigins({
      NEXT_PUBLIC_API_URL: 'https://api.example.com/api/v1',
      NEXT_PUBLIC_API_BASE: 'https://api.example.com',
    }, 'production'),
    ['https://api.example.com']
  );
});
