const { Op } = require('sequelize');
const logger = require('../../config/logger');
const { User } = require('../../models');
const {
  generateResetToken,
  hashResetToken,
  hashPassword,
  getResetExpiryDate,
  getResetExpiryMinutes,
  validatePasswordStrength
} = require('../../utils/password');
const {
  getTransporter,
  getFromAddress,
  isEmailEnabled,
  resetTransporterCache
} = require('./mailTransport');
const { buildPasswordResetEmail } = require('./emailTemplates');

const GENERIC_FORGOT_RESPONSE = 'If an account exists for this email, a reset link has been sent.';

const buildResetUrl = (rawToken) => {
  const base = String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

const sendPasswordResetEmail = async (user, rawToken) => {
  if (!isEmailEnabled()) {
    logger.error('Password reset email skipped: email delivery is not configured (set SMTP_* or EMAIL_ENABLED=true)');
    return { sent: false, reason: 'email-not-configured' };
  }

  const transporter = await getTransporter();
  if (!transporter) {
    logger.error('Password reset email skipped: mail transporter unavailable');
    return { sent: false, reason: 'missing-transporter' };
  }

  const resetUrl = buildResetUrl(rawToken);
  const expiryMinutes = getResetExpiryMinutes();
  const html = buildPasswordResetEmail({
    recipientName: user.full_name,
    resetUrl,
    expiryMinutes
  });

  const mailOptions = {
    from: getFromAddress(),
    to: user.email,
    subject: 'Reset your SBLE password',
    html
  };

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const activeTransporter = attempt === 1 ? transporter : await getTransporter();
      const info = await activeTransporter.sendMail(mailOptions);

      logger.info(`Password reset email sent to ${user.email}`, {
        messageId: info.messageId,
        accepted: info.accepted,
        attempt
      });
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      lastError = err;
      resetTransporterCache();
      logger.warn(`Password reset email attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  logger.error(`Password reset email failed for ${user.email}: ${lastError?.message || 'unknown error'}`);
  return { sent: false, error: lastError?.message || 'send-failed' };
};

const requestPasswordReset = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const err = new Error('A valid email address is required');
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({
    where: { email: normalizedEmail, is_active: true }
  });

  if (user) {
    const rawToken = generateResetToken();
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = getResetExpiryDate();

    await user.update({
      password_reset_token_hash: tokenHash,
      password_reset_expires_at: expiresAt
    });

    const result = await sendPasswordResetEmail(user, rawToken);
    if (!result.sent) {
      logger.error(`Password reset requested for ${normalizedEmail} but email was not delivered`);
    }
  }

  return { message: GENERIC_FORGOT_RESPONSE };
};

const resetPasswordWithToken = async (token, newPassword) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) {
    const err = new Error('Reset token is required');
    err.status = 400;
    throw err;
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    const err = new Error(strength.errors[0]);
    err.status = 400;
    err.details = strength.errors;
    throw err;
  }

  const tokenHash = hashResetToken(rawToken);
  const user = await User.findOne({
    where: {
      password_reset_token_hash: tokenHash,
      password_reset_expires_at: { [Op.gt]: new Date() },
      is_active: true
    }
  });

  if (!user) {
    const err = new Error('This reset link is invalid or has expired. Please request a new password reset.');
    err.status = 400;
    throw err;
  }

  const passwordHash = await hashPassword(newPassword);
  const nextTokenVersion = (user.token_version || 0) + 1;

  await user.update({
    password_hash: passwordHash,
    password_reset_token_hash: null,
    password_reset_expires_at: null,
    password_changed_at: new Date(),
    token_version: nextTokenVersion
  });

  logger.info(`Password reset completed for user ${user.id}`);
  return { message: 'Your password has been updated. You can now sign in with your new password.' };
};

module.exports = {
  GENERIC_FORGOT_RESPONSE,
  requestPasswordReset,
  resetPasswordWithToken,
  sendPasswordResetEmail,
  buildResetUrl
};
