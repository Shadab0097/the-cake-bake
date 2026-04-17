const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

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

module.exports = upload;
