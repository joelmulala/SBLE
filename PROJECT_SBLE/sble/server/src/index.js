require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');

const { sequelize } = require('./models');
const keycloak = require('./config/keycloak');
const logger = require('./config/logger');
const initWebRTC = require('./services/webrtc/signalingServer');
const initQuizTimer = require('./services/scheduler/quizTimer');

// Routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const materialRoutes = require('./routes/materials');
const assignmentRoutes = require('./routes/assignments');
const quizRoutes = require('./routes/quizzes');
const examRoutes = require('./routes/exams');
const roomRoutes = require('./routes/rooms');
const notificationRoutes = require('./routes/notifications');

const app = express();
const httpServer = createServer(app);

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
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
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

// Keycloak middleware
app.use(keycloak.middleware());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Init WebRTC signaling over WebSocket
initWebRTC(httpServer, redisClient);

// Init quiz auto-submit timer
initQuizTimer();

const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    logger.info('Database connected');
    httpServer.listen(PORT, () => logger.info(`SBLE server running on port ${PORT}`));
  })
  .catch(err => {
    logger.error('Database connection failed:', err);
    process.exit(1);
  });
