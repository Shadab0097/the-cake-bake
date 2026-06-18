const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');
const { isAllowedImageBuffer } = require('../utils/fileSignature');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // SECURITY: SVG excluded — SVGs can contain embedded <script> tags
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  // Also block SVG MIME type explicitly
  if (file.mimetype === 'image/svg+xml') {
    return cb(new ApiError(400, 'SVG files are not allowed for security reasons'));
  }

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only image files (JPEG, PNG, GIF, WebP) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880, // 5MB
    files: 10,
  },
});

// Post-multer guard: verify each uploaded buffer is a real image by its magic
// bytes, not just its (spoofable) extension/MIME. Mount after upload.single/array.
const verifyImageMagicBytes = (req, res, next) => {
  const files = req.files
    ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
    : (req.file ? [req.file] : []);

  for (const file of files) {
    if (!isAllowedImageBuffer(file.buffer)) {
      return next(new ApiError(400, 'Uploaded file is not a valid image', [
        { field: file.fieldname, code: 'INVALID_IMAGE_CONTENT', message: 'Uploaded file is not a valid image' },
      ], 'INVALID_IMAGE_CONTENT'));
    }
  }

  next();
};

module.exports = upload;
module.exports.verifyImageMagicBytes = verifyImageMagicBytes;
