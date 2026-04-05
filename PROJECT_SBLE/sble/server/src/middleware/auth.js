const keycloak = require('../config/keycloak');
const { AuditLog } = require('../models');

// Protect route — must be authenticated via Keycloak token
const protect = keycloak.protect();

// Role-based guard
const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.kauth?.grant?.access_token?.content?.realm_access?.roles || [];
  const hasRole = roles.some(r => userRoles.includes(r));
  if (!hasRole) return res.status(403).json({ error: 'Forbidden: insufficient role' });
  next();
};

// Attach user info from Keycloak token to req.user
const attachUser = (req, res, next) => {
  const token = req.kauth?.grant?.access_token?.content;
  if (token) {
    req.user = {
      id: token.sub,
      email: token.email,
      name: token.name,
      roles: token.realm_access?.roles || []
    };
  }
  next();
};

// Audit logging middleware
const audit = (action, resourceType) => async (req, res, next) => {
  try {
    await AuditLog.create({
      user_id: req.user?.id,
      action,
      resource_type: resourceType,
      resource_id: req.params?.id || null,
      ip_address: req.ip
    });
  } catch (_) { /* non-blocking */ }
  next();
};

module.exports = { protect, requireRole, attachUser, audit };
