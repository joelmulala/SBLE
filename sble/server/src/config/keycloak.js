const { verifyToken } = require('./auth');

const extractBearerToken = (authHeader = '') => {
  if (typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
};

const normalizeRoles = (payload = {}) => {
  if (Array.isArray(payload.roles) && payload.roles.length) return payload.roles;
  if (Array.isArray(payload.realm_access?.roles) && payload.realm_access.roles.length) {
    return payload.realm_access.roles;
  }
  if (payload.role) return [payload.role];
  return [];
};

const buildUserFromPayload = (payload = {}) => {
  const roles = normalizeRoles(payload);
  return {
    id: payload.sub || payload.id,
    email: payload.email || null,
    name: payload.name || payload.full_name || null,
    role: payload.role || roles[0] || null,
    roles
  };
};

const buildGrant = (user) => ({
  grant: {
    access_token: {
      content: {
        sub: user.id,
        email: user.email,
        name: user.name,
        realm_access: { roles: user.roles || [] }
      }
    }
  }
});

module.exports = {
  // Keep keycloak-connect compatible shape while enforcing local JWT validation.
  protect: () => (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const payload = verifyToken(token);
      const user = buildUserFromPayload(payload);

      if (!user.id) {
        return res.status(401).json({ error: 'Invalid token payload' });
      }

      req.auth = payload;
      req.user = user;
      req.kauth = buildGrant(user);
      return next();
    } catch (_) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  },

  middleware: () => (req, res, next) => next()
};
