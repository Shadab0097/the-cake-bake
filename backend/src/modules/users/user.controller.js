const userService = require('./user.service');
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
  const path = require('path');
  const avatarUrl = `/uploads/${path.basename(req.file.path)}`;
  const User = require('../../models/User');
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarUrl },
    { new: true }
  ).select('-passwordHash -refreshToken');
  ApiResponse.ok({ avatar: user.avatar }, 'Avatar updated').send(res);
});

module.exports = { getProfile, getPoints, updateProfile, updateAvatar, getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress };
