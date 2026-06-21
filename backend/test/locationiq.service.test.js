const test = require('node:test');
const assert = require('node:assert/strict');

// Configure a token + memory cache before the service (and its env) load.
process.env.LOCATIONIQ_API_KEY = 'test-token';
process.env.CACHE_STORE = 'memory';

const axios = require('axios');
const { env } = require('../src/config/env');
const locationiq = require('../src/modules/delivery/locationiq.service');

const withMockedAxiosGet = async (impl, fn) => {
  const original = axios.get;
  axios.get = impl;
  try {
    return await fn();
  } finally {
    axios.get = original;
  }
};

test('pickCity walks from most- to least-specific address fields', () => {
  assert.equal(locationiq.pickCity({ city: 'Amritsar', town: 'Ignored' }), 'Amritsar');
  assert.equal(locationiq.pickCity({ town: 'Tarn Taran' }), 'Tarn Taran');
  assert.equal(locationiq.pickCity({ state_district: 'Amritsar District' }), 'Amritsar District');
  assert.equal(locationiq.pickCity({}), null);
});

test('reverseGeocode maps a valid Indian postcode to pincode/city/state', async () => {
  await withMockedAxiosGet(
    async () => ({ data: { address: { postcode: '143001', city: 'Amritsar', state: 'Punjab' } } }),
    async () => {
      const out = await locationiq.reverseGeocode({ lat: 31.634, lng: 74.872 });
      assert.deepEqual(out, { pincode: '143001', city: 'Amritsar', state: 'Punjab' });
    }
  );
});

test('reverseGeocode returns null pincode when postcode is not a valid Indian pincode', async () => {
  await withMockedAxiosGet(
    async () => ({ data: { address: { postcode: 'AB1 2CD', town: 'Somewhere', state: 'Elsewhere' } } }),
    async () => {
      const out = await locationiq.reverseGeocode({ lat: 10.111, lng: 20.222 });
      assert.equal(out.pincode, null);
      assert.equal(out.city, 'Somewhere');
      assert.equal(out.state, 'Elsewhere');
    }
  );
});

test('reverseGeocode rejects pincodes starting with zero', async () => {
  await withMockedAxiosGet(
    async () => ({ data: { address: { postcode: '012345', village: 'Z' } } }),
    async () => {
      const out = await locationiq.reverseGeocode({ lat: 5.5, lng: 6.6 });
      assert.equal(out.pincode, null);
    }
  );
});

test('reverseGeocode throws GEOCODING_FAILED on upstream error (e.g. quota/429)', async () => {
  await withMockedAxiosGet(
    async () => {
      const err = new Error('rate limited');
      err.response = { status: 429 };
      throw err;
    },
    async () => {
      await assert.rejects(
        () => locationiq.reverseGeocode({ lat: 12.345, lng: 67.891 }),
        (err) => err.code === 'GEOCODING_FAILED' && err.statusCode === 400
      );
    }
  );
});

test('reverseGeocode throws GEOCODING_DISABLED when no API key is configured', async () => {
  const originalKey = env.locationiq.apiKey;
  env.locationiq.apiKey = '';
  try {
    await assert.rejects(
      () => locationiq.reverseGeocode({ lat: 1.5, lng: 2.5 }),
      (err) => err.code === 'GEOCODING_DISABLED' && err.statusCode === 400
    );
  } finally {
    env.locationiq.apiKey = originalKey;
  }
});
