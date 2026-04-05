const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
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
