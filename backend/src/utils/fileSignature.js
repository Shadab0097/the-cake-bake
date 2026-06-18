// Validate that an uploaded buffer's leading bytes match an allowed raster image
// format. File extension and MIME type are client-controlled and easily spoofed;
// magic bytes are content and cannot be faked without an actually-valid header.

const SIGNATURES = [
  { type: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
];

const startsWith = (buffer, bytes) =>
  buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte);

// WebP: "RIFF" .... "WEBP"
const isWebp = (buffer) =>
  buffer.length >= 12 &&
  buffer.toString('ascii', 0, 4) === 'RIFF' &&
  buffer.toString('ascii', 8, 12) === 'WEBP';

const isAllowedImageBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (isWebp(buffer)) return true;
  return SIGNATURES.some((signature) => startsWith(buffer, signature.bytes));
};

module.exports = { isAllowedImageBuffer };
