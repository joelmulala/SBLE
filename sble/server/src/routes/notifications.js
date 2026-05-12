const router = require('express').Router();
const { addClient } = require('../services/notifications/sseService');
const { verifyToken } = require('../config/auth');
const logger = require('../config/logger');

/**
 * SSE stream endpoint.
 * EventSource doesn't support custom headers, so the auth token
 * is accepted as a query param: GET /api/notifications/stream?token=<jwt>
 */
router.get('/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token required' });

  try {
    const payload = verifyToken(token);

    const userId = payload.sub;
    if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

    addClient(userId, res);
    logger.info(`SSE client connected: ${userId}`);
  } catch (err) {
    logger.error('SSE auth error:', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
});

module.exports = router;
