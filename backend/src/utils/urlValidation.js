const safeRelativeImagePattern = /^\/(?:uploads|images)\//;

const isSafeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const safeImageUrl = (value, helpers) => {
  if (!value) return value;
  if (safeRelativeImagePattern.test(value) || isSafeHttpUrl(value)) return value;
  return helpers.message('Image URL must be http(s) or a safe relative image path');
};

const safeLinkUrl = (value, helpers) => {
  if (!value) return value;
  if ((value.startsWith('/') && !value.startsWith('//')) || isSafeHttpUrl(value)) return value;
  return helpers.message('Link URL must be http(s) or a relative path');
};

module.exports = { safeImageUrl, safeLinkUrl };
