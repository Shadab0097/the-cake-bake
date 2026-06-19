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

/**
 * Upload multiple images in a single request. Returns an array of
 * { url, publicId, ... } in the same order as the provided files.
 */
export async function uploadAdminImages(files, context) {
  const list = Array.from(files || []);
  if (list.length === 0) return [];
  const formData = new FormData();
  list.forEach((file) => formData.append('images', file));
  formData.append('context', context);
  const res = await adminApiClient.post('/uploads/admin/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteAdminImage(publicId) {
  if (!publicId) return null;
  return adminApiClient.delete('/uploads/admin/image', { data: { publicId } });
}

/**
 * Turn a mixed, ordered list of image entries into the array shape the
 * products API expects. Existing entries have a `url`; new entries have a
 * `file` (a freshly chosen File) which is uploaded here.
 *
 * Returns { productImages, uploadedPublicIds }. `uploadedPublicIds` are the
 * images uploaded during THIS call so the caller can roll them back if the
 * subsequent product save fails. If the upload itself fails, any partial
 * uploads are rolled back before throwing.
 */
export async function prepareProductImages(images, { context = 'products', altFallback = '' } = {}) {
  const isSafeUrl = (url) => /^https?:\/\//i.test(url) || /^\/(?:uploads|images)\//i.test(url);
  const list = (Array.isArray(images) ? images : []).filter(
    // Keep file entries (to be uploaded) and URL entries. Only reject URL entries
    // that have no publicId (user-pasted) AND fail the safe-URL check.
    (entry) => entry?.file || (entry?.url && (entry.publicId || isSafeUrl(entry.url)))
  );
  const newFiles = list.filter((entry) => entry?.file).map((entry) => entry.file);
  let uploadedPublicIds = [];

  try {
    let uploadedQueue = [];
    if (newFiles.length > 0) {
      uploadedQueue = await uploadAdminImages(newFiles, context);
      uploadedPublicIds = uploadedQueue.map((image) => image.publicId).filter(Boolean);
    }

    let queueIndex = 0;
    const productImages = [];
    list.forEach((entry, index) => {
      if (entry?.file) {
        const uploaded = uploadedQueue[queueIndex++];
        if (uploaded) {
          productImages.push({
            url: uploaded.url,
            publicId: uploaded.publicId,
            alt: entry.alt || altFallback,
            sortOrder: index,
          });
        }
      } else if (entry?.url) {
        productImages.push({
          url: entry.url,
          publicId: entry.publicId || '',
          alt: entry.alt || altFallback,
          sortOrder: index,
        });
      }
    });

    return { productImages, uploadedPublicIds };
  } catch (err) {
    await Promise.all(uploadedPublicIds.map((id) => deleteAdminImage(id).catch(() => {})));
    throw err;
  }
}
