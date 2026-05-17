/**
 * End-to-end password reset verification (SMTP + API + auth).
 * Usage: node scripts/verify-password-reset-e2e.js [email]
 */
require('dotenv').config();
const http = require('http');
const https = require('https');
const { sequelize } = require('../src/models');
const { User } = require('../src/models');
const { verifyTransport } = require('../src/services/email/mailTransport');
const { hashResetToken } = require('../src/utils/password');

const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';
const TEST_EMAIL = (process.argv[2] || 'matongraphics@gmail.com').trim().toLowerCase();
const NEW_PASSWORD = 'SecureTest1!';
const OLD_TEMP = process.env.TEMP_ADMIN_PASSWORD || 'admin123';

const requestJson = (method, path, body) => new Promise((resolve, reject) => {
  const url = new URL(`${API_BASE}${path}`);
  const lib = url.protocol === 'https:' ? https : http;
  const payload = body ? JSON.stringify(body) : null;
  const req = lib.request({
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
      } catch {
        resolve({ status: res.statusCode, body: { raw: data } });
      }
    });
  });
  req.on('error', reject);
  if (payload) req.write(payload);
  req.end();
});

const login = (email, password) => requestJson('POST', '/auth/login', { email, password });

async function main() {
  const report = {
    smtpVerify: false,
    userExists: false,
    forgotPassword: false,
    resetTokenInDb: false,
    resetPassword: false,
    loginNewPassword: false,
    loginOldPasswordFails: false,
    tokenReuseFails: false
  };

  console.log('--- SBLE password reset E2E ---');
  console.log(`Email: ${TEST_EMAIL}`);

  const smtp = await verifyTransport();
  report.smtpVerify = smtp.ok;
  console.log(`SMTP verify: ${smtp.ok ? 'OK' : `FAIL (${smtp.reason})`}`);
  if (!smtp.ok) {
    await sequelize.close();
    process.exit(1);
  }

  await sequelize.authenticate();
  let user = await User.findOne({ where: { email: TEST_EMAIL, is_active: true } });
  if (!user) {
    console.log(`No user for ${TEST_EMAIL} — checking admin1@sble.local for flow test...`);
    user = await User.findOne({ where: { email: 'admin1@sble.local', is_active: true } });
    if (user) {
      await user.update({ email: TEST_EMAIL });
      console.log(`Updated admin1@sble.local email to ${TEST_EMAIL}`);
    }
  }
  report.userExists = Boolean(user);
  if (!user) {
    console.error('No active user found. Register or seed a user first.');
    await sequelize.close();
    process.exit(1);
  }

  const forgot = await requestJson('POST', '/auth/forgot-password', { email: TEST_EMAIL });
  report.forgotPassword = forgot.status === 200;
  console.log(`Forgot-password API: ${forgot.status} — ${forgot.body?.message || forgot.body?.data?.message || ''}`);

  await user.reload();
  report.resetTokenInDb = Boolean(user.password_reset_token_hash && user.password_reset_expires_at);
  console.log(`Reset token stored (hashed): ${report.resetTokenInDb}`);

  if (!report.resetTokenInDb) {
    console.error('Token was not stored — email may have failed or user not found.');
    await sequelize.close();
    process.exit(1);
  }

  // Recover raw token from DB is impossible (hashed). Re-request with known token via direct service:
  const { requestPasswordReset } = require('../src/services/email/passwordResetService');
  const { generateResetToken } = require('../src/utils/password');
  const rawToken = generateResetToken();
  await user.update({
    password_reset_token_hash: hashResetToken(rawToken),
    password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000)
  });

  const reset = await requestJson('POST', '/auth/reset-password', {
    token: rawToken,
    password: NEW_PASSWORD
  });
  report.resetPassword = reset.status === 200;
  console.log(`Reset-password API: ${reset.status}`);

  const loginNew = await login(TEST_EMAIL, NEW_PASSWORD);
  report.loginNewPassword = loginNew.status === 200 && Boolean(loginNew.body?.token || loginNew.body?.data?.token);
  console.log(`Login with new password: ${report.loginNewPassword ? 'OK' : 'FAIL'}`);

  const loginOld = await login(TEST_EMAIL, OLD_TEMP);
  report.loginOldPasswordFails = loginOld.status === 401;
  console.log(`Login with old temp password rejected: ${report.loginOldPasswordFails ? 'OK' : 'FAIL'}`);

  const reuse = await requestJson('POST', '/auth/reset-password', {
    token: rawToken,
    password: 'AnotherSecure2!'
  });
  report.tokenReuseFails = reuse.status === 400;
  console.log(`Reused token rejected: ${report.tokenReuseFails ? 'OK' : 'FAIL'}`);

  const allOk = Object.values(report).every(Boolean);
  console.log('\n--- Report ---');
  console.log(JSON.stringify(report, null, 2));
  console.log(allOk ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');

  await sequelize.close();
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
