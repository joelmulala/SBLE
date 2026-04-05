const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET is missing. Add it to server/.env before starting the backend.');
}

const EXPIRES_IN = '8h'; // token valid for 8 hours

/**
 * Sign a JWT token with user payload
 */
const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });

/**
 * Verify a JWT token — returns decoded payload or throws
 */
const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { signToken, verifyToken };
