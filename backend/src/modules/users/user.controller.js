const userService = require('./user.service');
const uploadService = require('../media/upload.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  ApiResponse.ok(user).send(res);
});

const getPoints = asyncHandler(async (req, res) => {
  const result = await userService.getPoints(req.user._id);
  ApiResponse.ok(result).send(res);
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  ApiResponse.ok(user, 'Profile updated').send(res);
});

const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await userService.getAddresses(req.user._id);
  ApiResponse.ok(addresses).send(res);
});

const createAddress = asyncHandler(async (req, res) => {
  const address = await userService.createAddress(req.user._id, req.body);
  ApiResponse.created(address, 'Address added').send(res);
});

const updateAddress = asyncHandler(async (req, res) => {
  const address = await userService.updateAddress(req.user._id, req.params.id, req.body);
  ApiResponse.ok(address, 'Address updated').send(res);
});

const deleteAddress = asyncHandler(async (req, res) => {
  await userService.deleteAddress(req.user._id, req.params.id);
  ApiResponse.ok(null, 'Address deleted').send(res);
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await userService.setDefaultAddress(req.user._id, req.params.id);
  ApiResponse.ok(address, 'Default address updated').send(res);
});

const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw require('../../utils/ApiError').badRequest('No file uploaded');
  const User = require('../../models/User');
  const currentUser = await User.findById(req.user._id).select('avatarPublicId');
  const uploaded = await uploadService.uploadImage(req.file, { context: 'avatars' });

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: uploaded.url, avatarPublicId: uploaded.publicId },
      { new: true }
    ).select('-passwordHash -refreshToken');

    await uploadService.deleteImage(currentUser?.avatarPublicId);
    ApiResponse.ok({ avatar: user.avatar, avatarPublicId: user.avatarPublicId }, 'Avatar updated').send(res);
  } catch (err) {
    await uploadService.deleteImage(uploaded.publicId);
    throw err;
  }
});

module.exports = { getProfile, getPoints, updateProfile, updateAvatar, getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };
