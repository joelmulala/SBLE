const logger = require('../config/logger');
const { isProduction } = require('../utils/validation');

const notFoundHandler = (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();

  if (!isProduction()) {
    logger.debug(`API route not found: ${req.method} ${req.originalUrl}`);
  }

  return res.status(404).json({
    success: false,
    message: 'Route not found',
    data: null
  });
};

const errorHandler = (err, req, res, next) => {
  const status = Number.isInteger(err?.status) ? err.status : 500;
  const clientMessage = status >= 500 && isProduction()
    ? 'An unexpected error occurred. Please try again.'
    : (err?.message || 'Internal server error');

  const detail = err?.stack || err;
  logger.error(`Request error on ${req.method} ${req.originalUrl}: ${detail}`);

  return res.status(status).json({
    success: false,
    message: clientMessage,
    data: null,
    ...(isProduction() ? {} : { error: err?.message })
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
