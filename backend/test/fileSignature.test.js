const test = require('node:test');
const assert = require('node:assert/strict');

const { isAllowedImageBuffer } = require('../src/utils/fileSignature');

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const gif = Buffer.from('GIF89a aaaaaa', 'ascii');
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

test('accepts real raster image signatures (jpeg/png/gif/webp)', () => {
  assert.equal(isAllowedImageBuffer(png), true);
  assert.equal(isAllowedImageBuffer(jpeg), true);
  assert.equal(isAllowedImageBuffer(gif), true);
  assert.equal(isAllowedImageBuffer(webp), true);
});

test('rejects spoofed/dangerous content regardless of extension or MIME', () => {
  assert.equal(isAllowedImageBuffer(Buffer.from('<html><script>alert(1)</script></html>')), false);
  assert.equal(isAllowedImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), false);
  assert.equal(isAllowedImageBuffer(Buffer.from('%PDF-1.7 fake')), false);
  assert.equal(isAllowedImageBuffer(Buffer.from('plain text payload')), false);
});

test('rejects empty, undersized, and non-buffer input', () => {
  assert.equal(isAllowedImageBuffer(Buffer.alloc(0)), false);
  assert.equal(isAllowedImageBuffer(Buffer.from([0xff, 0xd8])), false); // too short
  assert.equal(isAllowedImageBuffer(null), false);
  assert.equal(isAllowedImageBuffer('not a buffer'), false);
});
