const logger = require('../config/logger');

const notFoundHandler = (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  return res.status(404).json({
    success: false,
    message: 'Route not found',
    data: null
  });
};

const errorHandler = (err, req, res, next) => {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const message = err?.message || 'Internal server error';

  const detail = err?.stack || err;
  logger.error(`Request error on ${req.method} ${req.originalUrl}: ${detail}`);

  return res.status(status).json({
    success: false,
    message,
    data: null
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
