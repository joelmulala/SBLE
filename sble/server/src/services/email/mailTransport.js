const nodemailer = require('nodemailer');
const logger = require('../../config/logger');

const EMAIL_MODE = String(process.env.EMAIL_MODE || 'dev').toLowerCase();

const hasSmtpConfig = () => (
  Boolean(process.env.SMTP_HOST)
  && Boolean(process.env.SMTP_USER)
  && Boolean(process.env.SMTP_PASS)
);

const isEmailEnabled = () => {
  if (String(process.env.EMAIL_ENABLED || '').toLowerCase() === 'true') return true;
  if (hasSmtpConfig()) return true;
  if (EMAIL_MODE === 'dev' && process.env.EMAIL_ENABLED !== 'false') return true;
  return false;
};

const getFromAddress = () => {
  const name = String(process.env.MAIL_FROM_NAME || 'SBLE').trim();
  const address = String(
    process.env.MAIL_FROM_ADDRESS
    || process.env.SMTP_FROM
    || 'no-reply@sble.local'
  ).trim();
  return `${name} <${address}>`;
};

let transporterPromise = null;

const createSmtpTransporter = () => {
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 60_000,
    greetingTimeout: 30_000,
    socketTimeout: 60_000,
    tls: secure ? undefined : { minVersion: 'TLSv1.2' }
  });
};

const getTransporter = async () => {
  if (!isEmailEnabled()) return null;

  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (!hasSmtpConfig()) {
        if (EMAIL_MODE === 'production') {
          logger.error('EMAIL_MODE=production but SMTP_HOST/SMTP_USER/SMTP_PASS are not set');
          return null;
        }
        logger.warn('SMTP not configured; email delivery disabled (set SMTP_* for Brevo)');
        return null;
      }

      logger.info(`Email transport: Brevo SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
      return createSmtpTransporter();
    })();
  }

  return transporterPromise;
};

const verifyTransport = async () => {
  if (!isEmailEnabled()) {
    return { ok: false, reason: 'email-disabled' };
  }
  if (!hasSmtpConfig()) {
    return { ok: false, reason: 'smtp-not-configured' };
  }

  try {
    const transporter = await getTransporter();
    if (!transporter) {
      return { ok: false, reason: 'transporter-unavailable' };
    }
    await transporter.verify();
    logger.info('Brevo SMTP transport verified successfully');
    return { ok: true, host: process.env.SMTP_HOST, port: process.env.SMTP_PORT || '587' };
  } catch (err) {
    logger.error(`Brevo SMTP verification failed: ${err.message}`);
    return { ok: false, reason: err.message };
  }
};

const resetTransporterCache = () => {
  transporterPromise = null;
};

const getMailDiagnostics = () => ({
  enabled: isEmailEnabled(),
  mode: EMAIL_MODE,
  provider: hasSmtpConfig() ? 'brevo-smtp' : 'none',
  from: getFromAddress(),
  smtpConfigured: hasSmtpConfig(),
  smtpHost: process.env.SMTP_HOST || null,
  smtpPort: process.env.SMTP_PORT || null
});

module.exports = {
  getTransporter,
  getFromAddress,
  isEmailEnabled,
  hasSmtpConfig,
  verifyTransport,
  resetTransporterCache,
  getMailDiagnostics
};
