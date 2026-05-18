const authService = require('./auth.service');
const authSecurityService = require('./authSecurity.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  authService.setRefreshCookie(res, result.refreshScope, result.refreshToken);
  ApiResponse.created(authService.buildAuthResponse(result), 'Registration successful').send(res);
});

const login = asyncHandler(async (req, res) => {
  try {
    const result = await authService.login(req.body);
    if (result.refreshScope === 'admin') {
      await authSecurityService.recordAdminLoginSuccess(req, result.user);
    }
    authService.setRefreshCookie(res, result.refreshScope, result.refreshToken);
    ApiResponse.ok(authService.buildAuthResponse(result), 'Login successful').send(res);
  } catch (error) {
    if (authSecurityService.isAdminLoginRequest(req.body)) {
      await authSecurityService.recordAdminLoginFailure(req, error);
    }
    throw error;
  }
});

const refreshToken = asyncHandler(async (req, res) => {
  const scope = req.body.scope || 'customer';
  const refreshTokenValue = authService.getRefreshTokenFromRequest(req, scope);
  const tokens = await authService.refreshAccessToken(refreshTokenValue, scope);
  authService.setRefreshCookie(res, tokens.refreshScope, tokens.refreshToken);
  ApiResponse.ok({ accessToken: tokens.accessToken }, 'Token refreshed').send(res);
});

const logout = asyncHandler(async (req, res) => {
  const scope = req.body.scope || (authService.isAdminUser(req.user) ? 'admin' : 'customer');
  await authService.logout(req.user._id, scope);
  authService.clearRefreshCookie(res, scope);
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
