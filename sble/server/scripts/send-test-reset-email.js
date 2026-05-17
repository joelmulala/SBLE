require('dotenv').config();
const { resetTransporterCache, verifyTransport, getTransporter, getFromAddress } = require('../src/services/email/mailTransport');
const { buildPasswordResetEmail } = require('../src/services/email/emailTemplates');

const to = process.argv[2] || 'matongraphics@gmail.com';

(async () => {
  resetTransporterCache();
  const verified = await verifyTransport();
  if (!verified.ok) {
    console.error('SMTP verify failed:', verified.reason);
    process.exit(1);
  }

  const transporter = await getTransporter();
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=test-preview-only`;
  const html = buildPasswordResetEmail({
    recipientName: 'SBLE User',
    resetUrl,
    expiryMinutes: 30
  });

  const info = await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: 'SBLE password reset test',
    html
  });

  console.log('Sent:', { messageId: info.messageId, accepted: info.accepted, response: info.response });
  process.exit(0);
})().catch((err) => {
  console.error('Send failed:', err.message);
  process.exit(1);
});
