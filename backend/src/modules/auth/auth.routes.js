const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middleware/validate');
const authValidation = require('./auth.validation');
const { auth } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiter');

router.post('/register', authLimiter, validate(authValidation.register), authController.register);
router.post('/login', authLimiter, validate(authValidation.login), authController.login);
router.post('/refresh', validate(authValidation.refreshToken), authController.refreshToken);
router.post('/logout', auth, authController.logout);
router.post('/forgot-password', authLimiter, validate(authValidation.forgotPassword), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(authValidation.resetPassword), authController.resetPassword);
router.post('/verify-phone', authLimiter, authController.verifyPhone);

module.exports = router;
