const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { env } = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');

class AuthService {
  /**
   * Register new user
   */
  async register({ name, email, phone, password }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }

    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        throw ApiError.conflict('Phone number already registered');
      }
    }

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: password,
    });

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Send welcome notification — fire-and-forget, never blocks registration
    setImmediate(async () => {
      try {
        const notificationService = require('../notifications/notification.service');
        await notificationService.sendWelcomeNotification(user);
      } catch (err) {
        logger.warn('[Auth] Welcome notification failed:', err.message);
      }
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    const user = await User.findOne({ email }).select('+passwordHash +refreshToken');
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    user.lastLogin = new Date();
    await user.save();

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
      const user = await User.findById(decoded.id).select('+refreshToken');

      if (!user || user.refreshToken !== refreshToken) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId) {
    await User.findByIdAndUpdate(userId, { refreshToken: '' });
  }

  /**
   * Forgot password — generate reset token
   */
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save();

    // Send password reset email — fire-and-forget, never reveals whether email exists
    // SECURITY: resetToken is embedded in the link only — never returned in API response
    const resetUrl = `${env.app.url}/reset-password?token=${resetToken}`;
    setImmediate(async () => {
      try {
        const notificationService = require('../notifications/notification.service');
        await notificationService.sendPasswordResetEmail(user, resetUrl);
      } catch (err) {
        logger.warn('[Auth] Password reset email failed:', err.message);
      }
    });

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    user.passwordHash = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.refreshToken = '';
    await user.save();

    return { message: 'Password reset successful' };
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user) {
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      env.jwt.secret,
      { expiresIn: env.jwt.expire }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      env.jwt.refreshSecret,
      { expiresIn: env.jwt.refreshExpire }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Strip sensitive fields from user object
   */
  sanitizeUser(user) {
    const obj = user.toObject();
    delete obj.passwordHash;
    delete obj.refreshToken;
    delete obj.resetPasswordToken;
    delete obj.resetPasswordExpire;
    delete obj.__v;
    return obj;
  }
}

module.exports = new AuthService();
