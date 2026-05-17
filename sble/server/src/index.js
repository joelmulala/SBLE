require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');

const { sequelize } = require('./models');
const authGuard = require('./config/authGuard');
const logger = require('./config/logger');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const { logRegisteredRoutes } = require('./debugRouteTable');
const initWebRTC = require('./services/webrtc/signalingServer');
const initQuizTimer = require('./services/scheduler/quizTimer');
const { ensureInstitutionalSchema } = require('./services/academic/ensureInstitutionalSchema');
const { ensureCourseModulesSchema } = require('./services/academic/ensureCourseModulesSchema');
const { ensureCalendarSchema } = require('./services/academic/ensureCalendarSchema');
const { ensureLiveClassSchema } = require('./services/academic/ensureLiveClassSchema');
const { ensurePasswordAuthSchema } = require('./services/auth/ensurePasswordAuthSchema');
const { verifyTransport } = require('./services/email/mailTransport');

// Routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const materialRoutes = require('./routes/materials');
const assignmentRoutes = require('./routes/assignments');
const quizRoutes = require('./routes/quizzes');
const examRoutes = require('./routes/exams');
const roomRoutes = require('./routes/rooms');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const debugRoutes = require('./routes/debug');
const gradebookRoutes = require('./routes/gradebook');
const calendarRoutes = require('./routes/calendar');
const announcementRoutes = require('./routes/announcements');
const communicationRoutes = require('./routes/communication');

const app = express();
const httpServer = createServer(app);

if (process.env.NODE_ENV !== 'production') {
  logger.debug('Server entrypoint', {
    file: path.resolve(__filename),
    pid: process.pid
  });
}

const PERFORMANCE_SERVICE_URL = process.env.PERFORMANCE_SERVICE_URL || 'http://localhost:8000/analyze-performance';
const PERFORMANCE_SERVICE_TIMEOUT_MS = Number.parseInt(process.env.PERFORMANCE_SERVICE_TIMEOUT_MS || '2000', 10);

const requiredEnvVars = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'DB_HOST',
  'DB_NAME',
  'DB_USER'
];

const validateRequiredEnv = () => {
  const missing = requiredEnvVars.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(message);
    throw new Error(message);
  }
};

const toApiMessage = (statusCode, payload) => {
  if (payload?.message) return payload.message;
  if (payload?.error) return payload.error;
  if (statusCode >= 500) return 'Internal server error';
  if (statusCode >= 400) return 'Request failed';
  return 'OK';
};

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && Object.getPrototypeOf(value) === Object.prototype
);

const toSerializableObject = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (typeof payload.toJSON === 'function') {
    return payload.toJSON();
  }
  return payload;
};

// Redis client — optional, falls back to in-memory sessions if not configured
let redisClient = null;
if (process.env.REDIS_HOST) {
  const { createClient } = require('ioredis');
  redisClient = createClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined
  });
  redisClient.on('error', (err) => logger.error('Redis error:', err));
  logger.info('Redis session store enabled');
} else {
  logger.warn('REDIS_HOST not set — using in-memory session store (not suitable for production)');
}

// Security middleware
app.use(helmet());

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin requests without an Origin header.
    if (!origin) return callback(null, true);

    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Normalize API JSON responses while preserving existing payload contracts.
app.use('/api', (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const statusCode = res.statusCode || 200;
    const success = statusCode < 400;

    if (
      payload
      && typeof payload === 'object'
      && !Array.isArray(payload)
      && Object.prototype.hasOwnProperty.call(payload, 'success')
      && Object.prototype.hasOwnProperty.call(payload, 'message')
      && Object.prototype.hasOwnProperty.call(payload, 'data')
    ) {
      return originalJson(payload);
    }

    if (Array.isArray(payload)) {
      return originalJson({ success, message: toApiMessage(statusCode, payload), data: payload });
    }

    if (payload && typeof payload === 'object') {
      const normalizedPayload = toSerializableObject(payload);
      const message = toApiMessage(statusCode, normalizedPayload);
      const data = success
        ? normalizedPayload
        : (isPlainObject(normalizedPayload) && Object.keys(normalizedPayload).length > 1 ? normalizedPayload : null);

      if (isPlainObject(normalizedPayload)) {
        return originalJson({ success, message, data, ...normalizedPayload });
      }

      return originalJson({ success, message, data });
    }

    return originalJson({ success, message: toApiMessage(statusCode, payload), data: payload ?? null });
  };

  next();
});

// Rate limiting
const apiWindowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const apiMax = Number.parseInt(
  process.env.RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '100' : '1000'),
  10
);
const authMax = Number.parseInt(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '30' : '300'),
  10
);

const createLimiter = (max, options = {}) => rateLimit({
  windowMs: apiWindowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  ...options
});

// Keep auth protected but avoid accidental lockouts during active testing.
app.use('/api/auth', createLimiter(authMax));
app.use('/api', createLimiter(apiMax, {
  // /api/auth has its own limiter policy above.
  skip: (req) => req.path.startsWith('/auth/')
}));

// Session — Redis-backed in production, in-memory for local dev
const sessionConfig = {
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
};
if (redisClient) {
  const RedisStore = require('connect-redis').default;
  sessionConfig.store = new RedisStore({ client: redisClient });
}
app.use(session(sessionConfig));

app.use(authGuard.middleware());

if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_HTTP === 'true') {
  app.use((req, res, next) => {
    const url = req.originalUrl || req.url || '';
    if (url.includes('/api/rooms') || url.includes('livekit-token')) {
      logger.debug(`HTTP ${req.method} ${req.originalUrl}`);
    }
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gradebook', gradebookRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/users', userRoutes);
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_ADMIN_DEBUG === 'true') {
  app.use('/api/admin/debug', debugRoutes);
}

// Health check with dependency status.
app.get('/api/health', async (req, res) => {
  const health = {
    api: 'up',
    database: 'down',
    performanceService: 'down',
    timestamp: new Date().toISOString()
  };

  try {
    await sequelize.authenticate();
    health.database = 'up';
  } catch (err) {
    logger.error('Health check database probe failed:', err.message);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PERFORMANCE_SERVICE_TIMEOUT_MS);
  try {
    const response = await fetch(PERFORMANCE_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: [] }),
      signal: controller.signal
    });
    if (response.ok) health.performanceService = 'up';
  } catch (_) {
    // Service is optional; keep as down.
  } finally {
    clearTimeout(timeoutId);
  }

  const statusCode = health.database === 'up' ? 200 : 503;
  return res.status(statusCode).json(health);
});

if (process.env.NODE_ENV !== 'production') {
  logRegisteredRoutes(app, logger);
}

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.ENABLE_LEGACY_WEBRTC === 'true') {
  initWebRTC(httpServer, redisClient);
  logger.info('Legacy WebRTC signaling enabled (ENABLE_LEGACY_WEBRTC=true)');
} else {
  logger.info('Live classroom uses LiveKit; legacy WebRTC signaling is off');
}

// Init quiz auto-submit timer
initQuizTimer();

const PORT = process.env.PORT || 5000;

const connectToDatabaseWithRetry = async ({ retries = 5, delayMs = 2000 } = {}) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await sequelize.authenticate();
      logger.info('Database connected');
      return;
    } catch (err) {
      logger.error(`Database connection failed (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
};

process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logger.error(`Unhandled promise rejection: ${detail}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}\n${err.stack}`);
});

const startServer = async () => {
  try {
    validateRequiredEnv();
    await connectToDatabaseWithRetry();
    await ensureInstitutionalSchema();
    await ensureCourseModulesSchema();
    await ensureCalendarSchema();
    await ensureLiveClassSchema();
    await ensurePasswordAuthSchema();
    const smtpCheck = await verifyTransport();
    if (process.env.SMTP_HOST && !smtpCheck.ok) {
      logger.warn('SMTP is configured but verification failed — password reset emails may not deliver');
    }
    httpServer.listen(PORT, () => {
      const addr = httpServer.address();
      logger.info(`SBLE server running on port ${PORT}`);
      logger.debug('HTTP listener bound', { address: addr, port: PORT });
    });
  } catch (err) {
    logger.error('Server startup failed:', err);
    process.exit(1);
  }
};

startServer();
