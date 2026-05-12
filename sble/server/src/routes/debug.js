const router = require('express').Router();
const { sequelize } = require('../models');
const { protect, attachUser, requireRole } = require('../middleware/auth');
const { getClientCount } = require('../services/notifications/sseService');
const { getEmailDiagnostics } = require('../services/email/emailService');

const guard = [protect, attachUser, requireRole('admin')];
const PERFORMANCE_SERVICE_URL = process.env.PERFORMANCE_SERVICE_URL || 'http://localhost:8000/analyze-performance';
const PERFORMANCE_SERVICE_TIMEOUT_MS = Number.parseInt(process.env.PERFORMANCE_SERVICE_TIMEOUT_MS || '2000', 10);

const probePerformanceService = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PERFORMANCE_SERVICE_TIMEOUT_MS);

  try {
    const response = await fetch(PERFORMANCE_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: [] }),
      signal: controller.signal
    });
    return { up: response.ok, status: response.status };
  } catch (err) {
    return { up: false, status: 0, error: err.message };
  } finally {
    clearTimeout(timeoutId);
  }
};

router.get('/system', ...guard, async (req, res) => {
  const db = { up: false };

  try {
    await sequelize.authenticate();
    db.up = true;
  } catch (err) {
    db.error = err.message;
  }

  const performanceService = await probePerformanceService();
  const email = getEmailDiagnostics();

  const data = {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    authMode: 'jwt',
    keycloakCompatibility: {
      realm: process.env.KEYCLOAK_REALM || null,
      url: process.env.KEYCLOAK_URL || null,
      clientId: process.env.KEYCLOAK_CLIENT_ID || null
    },
    services: {
      api: { up: true },
      database: db,
      performanceService,
      redis: {
        configured: Boolean(process.env.REDIS_HOST),
        host: process.env.REDIS_HOST || null,
        port: process.env.REDIS_PORT || null
      },
      minio: {
        configured: Boolean(process.env.MINIO_ENDPOINT),
        endpoint: process.env.MINIO_ENDPOINT || null
      },
      notifications: {
        activeSseClients: getClientCount()
      }
    },
    email
  };

  const status = db.up ? 200 : 503;
  return res.status(status).json(data);
});

module.exports = router;
