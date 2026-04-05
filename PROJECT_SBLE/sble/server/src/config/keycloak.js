const Keycloak = require('keycloak-connect');

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
