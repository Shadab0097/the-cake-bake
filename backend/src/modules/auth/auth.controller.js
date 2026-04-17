const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  ApiResponse.created(result, 'Registration successful').send(res);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  ApiResponse.ok(result, 'Login successful').send(res);
});

const refreshToken = asyncHandler(async (req, res) => {
  const tokens = await authService.refreshAccessToken(req.body.refreshToken);
  ApiResponse.ok(tokens, 'Token refreshed').send(res);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id);
  ApiResponse.ok(null, 'Logged out successfully').send(res);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  ApiResponse.ok(result).send(res);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body.token, req.body.password);
  ApiResponse.ok(result).send(res);
});

// Placeholder: OTP phone verification (to be integrated with SMS provider)
const verifyPhone = asyncHandler(async (req, res) => {
  // TODO: Integrate with SMS OTP provider (e.g., MSG91, Fast2SMS)
  // For now, returns placeholder response
  ApiResponse.ok({ verified: false }, 'Phone verification endpoint ready — OTP provider not configured yet').send(res);
});

module.exports = { register, login, refreshToken, logout, forgotPassword, resetPassword, verifyPhone };
