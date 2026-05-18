'use strict';

const crypto = require('crypto');

const { env } = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const SIGNATURE_HEADER = 'x-hub-signature-256';
const SIGNATURE_PREFIX = 'sha256=';
const SHA256_HEX_LENGTH = 64;

const normalizeSignatureHeader = (signatureHeader) => {
  const value = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith(SIGNATURE_PREFIX)) return null;

  const signature = trimmed.slice(SIGNATURE_PREFIX.length).trim().toLowerCase();
  if (!/^[a-f0-9]+$/.test(signature) || signature.length !== SHA256_HEX_LENGTH) {
    return null;
  }

  return signature;
};

const toBuffer = (rawBody) => {
  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (typeof rawBody === 'string') return Buffer.from(rawBody, 'utf8');
  return null;
};

const timingSafeEqualHex = (actual, expected) => {
  if (!actual || !expected) return false;

  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const computeSignature = (rawBody, appSecret) => {
  const bodyBuffer = toBuffer(rawBody);
  if (!bodyBuffer) {
    throw ApiError.badRequest('Invalid webhook payload');
  }

  return crypto
    .createHmac('sha256', appSecret)
    .update(bodyBuffer)
    .digest('hex');
};

const verifySignature = ({
  rawBody,
  signatureHeader,
  appSecret = env.whatsapp.appSecret,
} = {}) => {
  const secret = typeof appSecret === 'string' ? appSecret.trim() : '';
  if (!secret) {
    throw ApiError.internal('WhatsApp webhook signature verification is not configured');
  }

  const receivedSignature = normalizeSignatureHeader(signatureHeader);
  if (!receivedSignature) {
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  const expectedSignature = computeSignature(rawBody, secret);
  if (!timingSafeEqualHex(receivedSignature, expectedSignature)) {
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  return true;
};

const parseJsonBody = (rawBody) => {
  const bodyBuffer = toBuffer(rawBody);
  if (!bodyBuffer || bodyBuffer.length === 0) {
    throw ApiError.badRequest('Invalid webhook payload');
  }

  try {
    return JSON.parse(bodyBuffer.toString('utf8'));
  } catch (err) {
    throw ApiError.badRequest('Invalid webhook payload');
  }
};

const verifySignatureMiddleware = (req, res, next) => {
  try {
    verifySignature({
      rawBody: req.body,
      signatureHeader: req.get(SIGNATURE_HEADER),
    });
    next();
  } catch (err) {
    next(err);
  }
};

const parseJsonBodyMiddleware = (req, res, next) => {
  try {
    req.body = parseJsonBody(req.body);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  SIGNATURE_HEADER,
  SIGNATURE_PREFIX,
  computeSignature,
  normalizeSignatureHeader,
  parseJsonBody,
  parseJsonBodyMiddleware,
  verifySignature,
  verifySignatureMiddleware,
};
