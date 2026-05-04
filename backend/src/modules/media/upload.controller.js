const uploadService = require('./upload.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

const uploadAdminImage = asyncHandler(async (req, res) => {
  const image = await uploadService.uploadImage(req.file, { context: req.body.context });
  ApiResponse.created(image, 'Image uploaded').send(res);
});

const uploadAdminImages = asyncHandler(async (req, res) => {
  const images = await uploadService.uploadImages(req.files, {
    context: req.body.context,
    maxFiles: 10,
  });
  ApiResponse.created(images, 'Images uploaded').send(res);
});

const deleteAdminImage = asyncHandler(async (req, res) => {
  if (!req.body.publicId) throw ApiError.badRequest('publicId is required');
  await uploadService.deleteImage(req.body.publicId);
  ApiResponse.ok(null, 'Image deleted').send(res);
});

module.exports = { uploadAdminImage, uploadAdminImages, deleteAdminImage };
