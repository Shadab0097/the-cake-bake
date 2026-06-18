const crypto = require('crypto');
const IdempotencyKey = require('../../models/IdempotencyKey');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');

const DEFAULT_LOCK_MS = 60 * 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

class IdempotencyService {
  getKeyFromRequest(req) {
    return req.get('Idempotency-Key') || req.get('X-Idempotency-Key') || req.body?.idempotencyKey || '';
  }

  serializePayload(payload) {
    return payload == null ? payload : JSON.parse(JSON.stringify(payload));
  }

  hashPayload(payload) {
    return crypto.createHash('sha256').update(stableStringify(payload || {})).digest('hex');
  }

  guestFingerprint(guestInfo = {}, ip = '') {
    const raw = `${(guestInfo.email || '').toLowerCase()}|${guestInfo.phone || ''}|${ip || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async execute({ key, scope, user = null, guestFingerprint = '', payload, ttlMs = DEFAULT_TTL_MS, lockMs = DEFAULT_LOCK_MS, handler }) {
    if (!key || typeof key !== 'string' || key.trim().length < 12 || key.length > 200) {
      throw ApiError.badRequest('A valid idempotency key is required for this request. Please refresh and try again.', [{ field: 'idempotencyKey', code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'A valid idempotency key is required for this request. Please refresh and try again.' }], 'IDEMPOTENCY_KEY_REQUIRED');
    }

    const normalizedKey = key.trim();
    const requestHash = this.hashPayload(payload);
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + lockMs);
    const expiresAt = new Date(now.getTime() + ttlMs);

    let record;
    try {
      record = await IdempotencyKey.create({
        key: normalizedKey,
        scope,
        user,
        guestFingerprint,
        requestHash,
        status: 'processing',
        lockedUntil,
        expiresAt,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;

      record = await IdempotencyKey.findOne({ scope, key: normalizedKey });
      if (!record) throw ApiError.conflict('Checkout is already being processed. Please wait a moment and retry.', [], 'CHECKOUT_IN_PROGRESS');

      const sameUser = String(record.user || '') === String(user || '');
      const sameGuest = !guestFingerprint || record.guestFingerprint === guestFingerprint;
      if (!sameUser || !sameGuest) {
        throw ApiError.conflict('This idempotency key is not valid for this checkout attempt. Please refresh and try again.', [], 'IDEMPOTENCY_KEY_MISMATCH');
      }

      if (record.requestHash !== requestHash) {
        throw ApiError.conflict('This idempotency key was already used for a different request. Please refresh and try again.', [], 'IDEMPOTENCY_KEY_REUSED');
      }

      if (record.status === 'completed') {
        logger.info(`[Idempotency] Replaying completed ${scope} request for key ${normalizedKey}`);
        return record.responsePayload;
      }

      if (record.status === 'processing' && record.lockedUntil > now) {
        throw ApiError.conflict('This request is already being processed. Please wait a moment.', [], 'REQUEST_IN_PROGRESS');
      }

      record.status = 'processing';
      record.lockedUntil = lockedUntil;
      record.expiresAt = expiresAt;
      record.lastError = '';
      await record.save();
    }

    try {
      const responsePayload = this.serializePayload(await handler());
      record.status = 'completed';
      record.responsePayload = responsePayload;
      record.completedAt = new Date();
      record.lockedUntil = new Date();
      await record.save();
      return responsePayload;
    } catch (error) {
      record.status = 'failed';
      record.lockedUntil = new Date();
      record.lastError = error.message || 'Request failed';
      await record.save().catch((saveError) => {
        logger.warn(`[Idempotency] Failed to persist failed state for ${scope}: ${saveError.message}`);
      });
      throw error;
    }
  }
}

module.exports = new IdempotencyService();
