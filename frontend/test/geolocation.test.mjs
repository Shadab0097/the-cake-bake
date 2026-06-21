import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GEO_ERRORS,
  isGeolocationEnabled,
  isGeolocationSupported,
  getCurrentPosition,
} from '../src/lib/geolocation.mjs';

const setNavigator = (value) => {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, 'navigator');
    return;
  }
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  });
};

test('isGeolocationEnabled defaults on, off only when explicitly "false"', () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION;
  try {
    delete process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION;
    assert.equal(isGeolocationEnabled(), true);

    process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION = 'true';
    assert.equal(isGeolocationEnabled(), true);

    process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION = 'false';
    assert.equal(isGeolocationEnabled(), false);
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION;
    else process.env.NEXT_PUBLIC_ENABLE_GEOLOCATION = original;
  }
});

test('isGeolocationSupported reflects navigator.geolocation presence', () => {
  setNavigator({});
  assert.equal(isGeolocationSupported(), false);

  setNavigator({ geolocation: { getCurrentPosition() {} } });
  assert.equal(isGeolocationSupported(), true);

  setNavigator(undefined);
});

test('getCurrentPosition resolves with normalized coordinates', async () => {
  setNavigator({
    geolocation: {
      getCurrentPosition(success) {
        success({ coords: { latitude: 31.63, longitude: 74.87, accuracy: 25 } });
      },
    },
  });
  try {
    const pos = await getCurrentPosition({ timeout: 100 });
    assert.deepEqual(pos, { lat: 31.63, lng: 74.87, accuracy: 25 });
  } finally {
    setNavigator(undefined);
  }
});

test('getCurrentPosition maps permission denial (code 1) to GEO_DENIED', async () => {
  setNavigator({
    geolocation: {
      getCurrentPosition(_success, failure) {
        failure({ code: 1, message: 'denied' });
      },
    },
  });
  try {
    await assert.rejects(getCurrentPosition({ timeout: 100 }), (err) => err.code === GEO_ERRORS.DENIED);
  } finally {
    setNavigator(undefined);
  }
});

test('getCurrentPosition maps timeout (code 3) to GEO_TIMEOUT', async () => {
  setNavigator({
    geolocation: {
      getCurrentPosition(_success, failure) {
        failure({ code: 3, message: 'timed out' });
      },
    },
  });
  try {
    await assert.rejects(getCurrentPosition({ timeout: 100 }), (err) => err.code === GEO_ERRORS.TIMEOUT);
  } finally {
    setNavigator(undefined);
  }
});

test('getCurrentPosition rejects GEO_UNSUPPORTED without geolocation support', async () => {
  setNavigator({});
  try {
    await assert.rejects(getCurrentPosition({ timeout: 100 }), (err) => err.code === GEO_ERRORS.UNSUPPORTED);
  } finally {
    setNavigator(undefined);
  }
});
