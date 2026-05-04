import adminApiClient from './adminApiClient';

export const IMAGE_UPLOAD = {
  maxSize: 5 * 1024 * 1024,
  maxInquiryFiles: 5,
  accept: 'image/jpeg,image/png,image/webp,image/gif',
};

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function validateImageFiles(files, { maxFiles = 1, maxSize = IMAGE_UPLOAD.maxSize } = {}) {
  const list = Array.from(files || []);
  if (list.length > maxFiles) {
    throw new Error(`Upload up to ${maxFiles} image${maxFiles === 1 ? '' : 's'}`);
  }

  list.forEach((file) => {
    if (!allowedTypes.has(file.type)) {
      throw new Error('Only JPEG, PNG, GIF, and WebP images are allowed');
    }
    if (file.size > maxSize) {
      throw new Error('Each image must be 5MB or less');
    }
  });

  return list;
}

export function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('/')) {
    return `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'}${url}`;
  }
  return url;
}

export function createImagePreview(file) {
  return file ? URL.createObjectURL(file) : '';
}

export async function uploadAdminImage(file, context) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('context', context);
  const res = await adminApiClient.post('/uploads/admin/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteAdminImage(publicId) {
  if (!publicId) return null;
  return adminApiClient.delete('/uploads/admin/image', { data: { publicId } });
}
