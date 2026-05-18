const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middleware/validate');
const authValidation = require('./auth.validation');
const { auth } = require('../../middleware/auth');
const {
  adminLoginLimiter,
  loginLimiter,
  passwordResetLimiter,
  phoneVerificationLimiter,
  registrationLimiter,
} = require('../../middleware/rateLimiter');

router.post('/register', registrationLimiter, validate(authValidation.register), authController.register);
router.post('/login', adminLoginLimiter, loginLimiter, validate(authValidation.login), authController.login);
router.post('/refresh', validate(authValidation.refreshToken), authController.refreshToken);
router.post('/logout', auth, authController.logout);
router.post('/forgot-password', passwordResetLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(authValidation.resetPassword), authController.resetPassword);
router.post('/verify-phone', phoneVerificationLimiter, validate(authValidation.verifyPhone), authController.verifyPhone);

module.exports = router;
