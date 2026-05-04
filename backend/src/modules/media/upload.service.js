const { Readable } = require('stream');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');
const { env } = require('../../config/env');
const { cloudinary, isCloudinaryConfigured } = require('../../config/cloudinary');

const CONTEXT_FOLDERS = Object.freeze({
  products: 'products',
  categories: 'categories',
  addons: 'addons',
  banners: 'banners',
  avatars: 'avatars',
  custom_inquiries: 'inquiries/custom',
  corporate_inquiries: 'inquiries/corporate',
  reviews: 'reviews',
});

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const getExtension = (filename = '') => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : '';
};

const hasAllowedMagicBytes = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const header6 = buffer.subarray(0, 6).toString('ascii');
  const isGif = header6 === 'GIF87a' || header6 === 'GIF89a';
  const isWebp = buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  return isJpeg || isPng || isGif || isWebp;
};

const normalizeFolder = (folder) => folder.replace(/^\/+|\/+$/g, '');

const getUploadFolder = (context) => {
  const contextFolder = CONTEXT_FOLDERS[context];
  if (!contextFolder) {
    throw ApiError.badRequest('Invalid upload context');
  }
  return `${normalizeFolder(env.cloudinary.folder)}/${contextFolder}`;
};

const assertCloudinaryReady = () => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'Image upload service is not configured');
  }
};

const validateImageFile = (file) => {
  if (!file) throw ApiError.badRequest('No image file uploaded');

  const extension = getExtension(file.originalname);
  if (file.mimetype === 'image/svg+xml' || extension === '.svg') {
    throw ApiError.badRequest('SVG files are not allowed');
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(extension)) {
    throw ApiError.badRequest('Only JPEG, PNG, GIF, and WebP images are allowed');
  }

  if (!file.buffer || !hasAllowedMagicBytes(file.buffer)) {
    throw ApiError.badRequest('Uploaded file is not a valid image');
  }

  if (file.size > env.upload.maxFileSize) {
    throw ApiError.badRequest(`Image size must be ${Math.floor(env.upload.maxFileSize / 1024 / 1024)}MB or less`);
  }
};

const uploadImage = async (file, { context }) => {
  validateImageFile(file);
  const folder = getUploadFolder(context);
  assertCloudinaryReady();

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          overwrite: false,
          unique_filename: true,
          use_filename: false,
        },
        (error, uploadResult) => {
          if (error) return reject(error);
          resolve(uploadResult);
        }
      );

      Readable.from(file.buffer).pipe(stream);
    });

    return {
      url: result.secure_url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
    };
  } catch (err) {
    logger.error('[Cloudinary] upload failed', {
      message: err.message,
      context,
      filename: file.originalname,
    });
    throw new ApiError(502, 'Image upload failed');
  }
};

const uploadImages = async (files, { context, maxFiles = 10 }) => {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) throw ApiError.badRequest('No image files uploaded');
  if (list.length > maxFiles) throw ApiError.badRequest(`You can upload up to ${maxFiles} images`);

  const uploaded = [];
  try {
    for (const file of list) {
      uploaded.push(await uploadImage(file, { context }));
    }
    return uploaded;
  } catch (err) {
    await deleteImages(uploaded.map((image) => image.publicId));
    throw err;
  }
};

const deleteImage = async (publicId) => {
  if (!publicId || !isCloudinaryConfigured()) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    logger.warn('[Cloudinary] delete failed', { publicId, message: err.message });
    return null;
  }
};

const deleteImages = async (publicIds = []) => {
  const uniquePublicIds = [...new Set(publicIds.filter(Boolean))];
  await Promise.all(uniquePublicIds.map((publicId) => deleteImage(publicId)));
};

module.exports = {
  CONTEXT_FOLDERS,
  uploadImage,
  uploadImages,
  deleteImage,
  deleteImages,
};
