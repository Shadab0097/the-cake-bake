const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { env } = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const logger = require('../../middleware/logger');
const { USER_ROLES } = require('../../utils/constants');

const REFRESH_SCOPES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
};

const REFRESH_COOKIE_NAMES = {
  [REFRESH_SCOPES.CUSTOMER]: 'tcb_customer_refresh',
  [REFRESH_SCOPES.ADMIN]: 'tcb_admin_refresh',
};

const REFRESH_TOKEN_FIELDS = {
  [REFRESH_SCOPES.CUSTOMER]: 'refreshToken',
  [REFRESH_SCOPES.ADMIN]: 'adminRefreshToken',
};

const REFRESH_REUSE_FIELDS = {
  [REFRESH_SCOPES.CUSTOMER]: 'refreshTokenReuseDetectedAt',
  [REFRESH_SCOPES.ADMIN]: 'adminRefreshTokenReuseDetectedAt',
};

const DEFAULT_REFRESH_COOKIE_MS = 30 * 24 * 60 * 60 * 1000;

class AuthService {
  normalizeScope(scope = REFRESH_SCOPES.CUSTOMER) {
    return scope === REFRESH_SCOPES.ADMIN ? REFRESH_SCOPES.ADMIN : REFRESH_SCOPES.CUSTOMER;
  }

  isAdminUser(user) {
    return user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPERADMIN;
  }

  getRefreshTokenField(scope) {
    return REFRESH_TOKEN_FIELDS[this.normalizeScope(scope)];
  }

  getRefreshReuseField(scope) {
    return REFRESH_REUSE_FIELDS[this.normalizeScope(scope)];
  }

  getRefreshCookieName(scope) {
    return REFRESH_COOKIE_NAMES[this.normalizeScope(scope)];
  }

  parseDurationMs(value, fallback = DEFAULT_REFRESH_COOKIE_MS) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

    const match = String(value || '').trim().match(/^(\d+)\s*([smhd])?$/i);
    if (!match) return fallback;

    const amount = Number(match[1]);
    const unit = (match[2] || 'ms').toLowerCase();
    const multipliers = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * (multipliers[unit] || multipliers.ms);
  }

  getRefreshCookieOptions({ includeMaxAge = true } = {}) {
    const options = {
      httpOnly: true,
      secure: env.isProd(),
      sameSite: env.isProd() ? 'none' : 'lax',
      path: '/api/v1/auth',
    };

    if (includeMaxAge) {
      options.maxAge = this.parseDurationMs(env.jwt.refreshExpire);
    }

    return options;
  }

  setRefreshCookie(res, scope, refreshToken) {
    res.cookie(
      this.getRefreshCookieName(scope),
      refreshToken,
      this.getRefreshCookieOptions()
    );
  }

  clearRefreshCookie(res, scope) {
    res.clearCookie(
      this.getRefreshCookieName(scope),
      this.getRefreshCookieOptions({ includeMaxAge: false })
    );
  }

  getRefreshTokenFromRequest(req, scope) {
    const normalizedScope = this.normalizeScope(scope || req.body?.scope);
    return (
      req.cookies?.[this.getRefreshCookieName(normalizedScope)] ||
      req.body?.refreshToken ||
      ''
    );
  }

  hashRefreshToken(refreshToken) {
    return crypto
      .createHash('sha256')
      .update(String(refreshToken || ''))
      .digest('hex');
  }

  buildAuthResponse(result) {
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  /**
   * Register new user
   */
  async register({ name, email, phone, password }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('Email already registered', [{ field: 'email', code: 'EMAIL_EXISTS', message: 'Email already registered' }], 'EMAIL_EXISTS');
    }

    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        throw ApiError.conflict('Phone number already registered', [{ field: 'phone', code: 'PHONE_EXISTS', message: 'Phone number already registered' }], 'PHONE_EXISTS');
      }
    }

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash: password,
    });

    const tokens = this.generateTokens(user, REFRESH_SCOPES.CUSTOMER);
    user.refreshToken = this.hashRefreshToken(tokens.refreshToken);
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
      refreshScope: REFRESH_SCOPES.CUSTOMER,
    };
  }

  /**
   * Login user — with account lockout protection
   */
  async login({ email, password, scope = REFRESH_SCOPES.CUSTOMER }) {
    const refreshScope = this.normalizeScope(scope);
    const refreshTokenField = this.getRefreshTokenField(refreshScope);
    const user = await User.findOne({ email }).select(`+passwordHash +${refreshTokenField} +failedLoginAttempts +lockUntil`);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password', [], 'INVALID_CREDENTIALS');
    }

    // Check if account is active
    if (user.isActive === false) {
      throw ApiError.unauthorized('Your account has been disabled. Please contact support.', [], 'ACCOUNT_DISABLED');
    }

    // Check if account is currently locked
    if (user.isLocked()) {
      const unlockMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw ApiError.unauthorized(`Account temporarily locked due to too many failed attempts. Try again in ${unlockMinutes} minute(s).`, [], 'ACCOUNT_LOCKED');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed attempts
      const MAX_ATTEMPTS = 5;
      const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0; // reset counter; lockUntil is the guard now
        await user.save();
        throw ApiError.unauthorized('Account temporarily locked after too many failed attempts. Try again in 15 minutes.', [], 'ACCOUNT_LOCKED');
      }

      await user.save();
      throw ApiError.unauthorized('Invalid email or password', [], 'INVALID_CREDENTIALS');
    }

    if (refreshScope === REFRESH_SCOPES.ADMIN && !this.isAdminUser(user)) {
      throw ApiError.forbidden('Admin access required', [], 'ADMIN_ACCESS_REQUIRED');
    }
    if (refreshScope === REFRESH_SCOPES.CUSTOMER && this.isAdminUser(user)) {
      throw ApiError.forbidden('Customer access required', [], 'CUSTOMER_ACCESS_REQUIRED');
    }

    // Successful login — reset lockout counters
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;

    const tokens = this.generateTokens(user, refreshScope);
    user[refreshTokenField] = this.hashRefreshToken(tokens.refreshToken);
    user.lastLogin = new Date();
    await user.save();

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      refreshScope,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken, scope = REFRESH_SCOPES.CUSTOMER) {
    const refreshScope = this.normalizeScope(scope);
    const refreshTokenField = this.getRefreshTokenField(refreshScope);
    const reuseField = this.getRefreshReuseField(refreshScope);

    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token is required', [], 'REFRESH_TOKEN_REQUIRED');
    }

    try {
      const decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
      if (decoded.scope && decoded.scope !== refreshScope) {
        throw ApiError.unauthorized('Invalid refresh token', [], 'INVALID_REFRESH_TOKEN');
      }

      const user = await User.findById(decoded.id).select(`+${refreshTokenField}`);
      if (!user) {
        throw ApiError.unauthorized('Invalid refresh token', [], 'INVALID_REFRESH_TOKEN');
      }

      if (refreshScope === REFRESH_SCOPES.ADMIN && !this.isAdminUser(user)) {
        await User.updateOne(
          { _id: user._id },
          { $set: { [refreshTokenField]: '' } }
        );
        throw ApiError.forbidden('Admin access required', [], 'ADMIN_ACCESS_REQUIRED');
      }
      if (refreshScope === REFRESH_SCOPES.CUSTOMER && this.isAdminUser(user)) {
        await User.updateOne(
          { _id: user._id },
          { $set: { [refreshTokenField]: '' } }
        );
        throw ApiError.forbidden('Customer access required', [], 'CUSTOMER_ACCESS_REQUIRED');
      }

      const incomingHash = this.hashRefreshToken(refreshToken);
      if (!user[refreshTokenField]) {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              [refreshTokenField]: '',
              [reuseField]: new Date(),
            },
          }
        );
        throw ApiError.unauthorized('Invalid refresh token', [], 'INVALID_REFRESH_TOKEN');
      }

      const tokens = this.generateTokens(user, refreshScope);
      const rotatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          [refreshTokenField]: incomingHash,
        },
        {
          $set: {
            [refreshTokenField]: this.hashRefreshToken(tokens.refreshToken),
          },
        },
        { new: true }
      );

      if (!rotatedUser) {
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              [refreshTokenField]: '',
              [reuseField]: new Date(),
            },
          }
        );
        throw ApiError.unauthorized('Invalid refresh token', [], 'INVALID_REFRESH_TOKEN');
      }

      return {
        ...tokens,
        refreshScope,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Invalid or expired refresh token', [], 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Logout user
   */
  async logout(userId, scope = REFRESH_SCOPES.CUSTOMER) {
    const refreshScope = this.normalizeScope(scope);
    await User.findByIdAndUpdate(userId, { [this.getRefreshTokenField(refreshScope)]: '' });
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
      throw ApiError.badRequest('Invalid or expired reset token', [], 'INVALID_RESET_TOKEN');
    }

    user.passwordHash = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.refreshToken = '';
    user.adminRefreshToken = '';
    await user.save();

    return { message: 'Password reset successful' };
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user, scope = REFRESH_SCOPES.CUSTOMER) {
    const refreshScope = this.normalizeScope(scope);
    const accessToken = jwt.sign(
      { id: user._id, role: user.role, scope: refreshScope },
      env.jwt.secret,
      { expiresIn: env.jwt.expire }
    );

    const refreshToken = jwt.sign(
      {
        id: user._id,
        scope: refreshScope,
        jti: crypto.randomUUID(),
      },
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
    delete obj.adminRefreshToken;
    delete obj.refreshTokenReuseDetectedAt;
    delete obj.adminRefreshTokenReuseDetectedAt;
    delete obj.resetPasswordToken;
    delete obj.resetPasswordExpire;
    delete obj.__v;
    return obj;
  }
}

module.exports = new AuthService();
