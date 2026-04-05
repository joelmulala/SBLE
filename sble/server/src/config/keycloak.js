const Keycloak = require('keycloak-connect');
const { verifyToken } = require('./auth');

const authDisabled = process.env.AUTH_DISABLED === 'true';

if (authDisabled) {
  const buildGrant = (payload) => ({
    grant: {
      access_token: {
        content: {
          sub: payload.sub || payload.id,
          email: payload.email,
          name: payload.name,
          realm_access: { roles: payload.roles || (payload.role ? [payload.role] : []) }
        }
      }
    }
  });

  module.exports = {
    protect: () => (req, res, next) => {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        const payload = verifyToken(token);
        req.kauth = buildGrant(payload);
        req.auth = payload;
        next();
      } catch (_) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    },
    middleware: () => (req, res, next) => next()
  };
  return;
}

// Keycloak configuration pointing to our self-hosted instance
const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM,
  'auth-server-url': process.env.KEYCLOAK_URL,
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT_ID,
  'public-client': true,
  'confidential-port': 0
};

const keycloak = new Keycloak({}, keycloakConfig);

module.exports = keycloak;
