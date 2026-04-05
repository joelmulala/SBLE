const nodemailer = require('nodemailer');
const logger = require('../../config/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const FROM = process.env.SMTP_FROM || 'SBLE <no-reply@sble.local>';

const sendMail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured — skipping email');
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logger.error('Email send failed:', err.message);
  }
};

module.exports = {
  sendGradeNotification: (email, assignmentTitle, grade, feedback) =>
    sendMail({
      to: email,
      subject: `Your submission for "${assignmentTitle}" has been graded`,
      html: `<p>You received a grade of <strong>${grade}</strong>.</p>${feedback ? `<p>Feedback: ${feedback}</p>` : ''}`
    }),

  sendExamReleaseNotification: (emails, examTitle, courseTitle) =>
    sendMail({
      to: emails.join(','),
      subject: `Exam available: ${examTitle}`,
      html: `<p>The exam <strong>${examTitle}</strong> for <strong>${courseTitle}</strong> is now available. Log in to download it.</p>`
    })
};
