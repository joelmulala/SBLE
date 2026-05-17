const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_BYTES = 32;
const DEFAULT_RESET_EXPIRY_MINUTES = 30;

const getResetExpiryMinutes = () => {
  const parsed = Number.parseInt(process.env.PASSWORD_RESET_EXPIRY_MINUTES || '', 10);
  if (Number.isFinite(parsed) && parsed >= 15 && parsed <= 30) return parsed;
  return DEFAULT_RESET_EXPIRY_MINUTES;
};

const hashPassword = async (plain) => bcrypt.hash(String(plain), BCRYPT_ROUNDS);

const verifyPassword = async (plain, hash) => {
  if (!hash) return false;
  return bcrypt.compare(String(plain), String(hash));
};

const generateResetToken = () => crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');

const hashResetToken = (token) => (
  crypto.createHash('sha256').update(String(token)).digest('hex')
);

const getResetExpiryDate = () => {
  const minutes = getResetExpiryMinutes();
  return new Date(Date.now() + minutes * 60 * 1000);
};

const validatePasswordStrength = (password) => {
  const value = String(password || '');
  const errors = [];

  if (value.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[a-z]/.test(value)) errors.push('Password must include a lowercase letter');
  if (!/[A-Z]/.test(value)) errors.push('Password must include an uppercase letter');
  if (!/[0-9]/.test(value)) errors.push('Password must include a number');

  return { valid: errors.length === 0, errors };
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
  getResetExpiryDate,
  getResetExpiryMinutes,
  validatePasswordStrength
};
