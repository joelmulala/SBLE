const nodemailer = require('nodemailer');
const logger = require('../../config/logger');
const { getTransporter, getFromAddress, isEmailEnabled, getMailDiagnostics } = require('./mailTransport');

const EMAIL_MODE = String(process.env.EMAIL_MODE || 'dev').toLowerCase();

let lastEmailDispatch = null;

const sendEmail = async (to, subject, html) => {
  const startedAt = new Date().toISOString();

  if (!isEmailEnabled()) {
    logger.info(`[EMAIL DISABLED] Skipping "${subject}"`);
    lastEmailDispatch = {
      to,
      subject,
      mode: EMAIL_MODE,
      enabled: false,
      attemptedAt: startedAt,
      status: 'skipped',
      reason: 'email-not-enabled'
    };
    return { skipped: true, reason: 'email-not-enabled' };
  }

  const transporter = await getTransporter();
  if (!transporter) {
    lastEmailDispatch = {
      to,
      subject,
      mode: EMAIL_MODE,
      enabled: true,
      attemptedAt: startedAt,
      status: 'skipped',
      reason: 'missing-email-transporter'
    };
    return { skipped: true, reason: 'missing-email-transporter' };
  }

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      html
    });
    logger.info(`Email sent to ${to}: ${subject}`);
    const previewUrl = EMAIL_MODE === 'dev' && !process.env.SMTP_HOST
      ? nodemailer.getTestMessageUrl(info)
      : null;

    if (previewUrl) logger.info(`Ethereal preview URL: ${previewUrl}`);

    lastEmailDispatch = {
      to,
      subject,
      mode: EMAIL_MODE,
      enabled: true,
      attemptedAt: startedAt,
      status: 'sent',
      messageId: info.messageId,
      previewUrl
    };

    return { sent: true, messageId: info.messageId, previewUrl };
  } catch (err) {
    logger.error(`Email send failed: ${err?.message || 'unknown error'}`);
    lastEmailDispatch = {
      to,
      subject,
      mode: EMAIL_MODE,
      enabled: true,
      attemptedAt: startedAt,
      status: 'failed',
      error: err.message
    };
    return { sent: false, error: err.message };
  }
};

const getEmailDiagnostics = () => ({
  ...getMailDiagnostics(),
  lastEmailDispatch
});

const sendLoginNotification = (user, context = {}) => {
  const username = user?.full_name || user?.name || user?.email || 'User';
  const loginTime = context.loginTime || new Date().toISOString();
  const ip = context.ip || 'N/A';

  return sendEmail(
    user?.email,
    'New login to your SBLE account',
    `<p>Hello <strong>${username}</strong>,</p>
     <p>A login to your SBLE account was detected.</p>
     <ul>
       <li><strong>Username:</strong> ${username}</li>
       <li><strong>Login time:</strong> ${loginTime}</li>
       <li><strong>IP:</strong> ${ip}</li>
     </ul>
     <p>If this was not you, please contact support immediately.</p>`
  );
};

const sendAssignmentGraded = (user, assignment = {}) => {
  const title = assignment.title || assignment.assignmentTitle || 'Assignment';
  const grade = assignment.grade ?? 'N/A';
  const feedback = assignment.feedback || '';

  return sendEmail(
    user?.email,
    `Your submission for "${title}" has been graded`,
    `<p>Hello <strong>${user?.full_name || user?.name || user?.email || 'Student'}</strong>,</p>
     <p>Your assignment <strong>${title}</strong> has been graded.</p>
     <p><strong>Grade:</strong> ${grade}</p>
     ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}`
  );
};

const sendExamReleased = (user, exam = {}) => {
  const examTitle = exam.title || 'Exam';
  const courseTitle = exam.courseTitle || exam.course || '';

  return sendEmail(
    user?.email,
    `Exam available: ${examTitle}`,
    `<p>Hello <strong>${user?.full_name || user?.name || user?.email || 'Student'}</strong>,</p>
     <p>The exam <strong>${examTitle}</strong>${courseTitle ? ` for <strong>${courseTitle}</strong>` : ''} is now available.</p>
     <p>Please log in to SBLE to access it.</p>`
  );
};

const sendGradeNotification = (email, assignmentTitle, grade, feedback) =>
  sendAssignmentGraded({ email }, { title: assignmentTitle, grade, feedback });

const sendExamReleaseNotification = (emails, examTitle, courseTitle) => {
  const recipients = Array.isArray(emails) ? emails.filter(Boolean) : [];
  return Promise.all(recipients.map((email) => sendExamReleased({ email }, { title: examTitle, courseTitle })));
};

module.exports = {
  sendEmail,
  sendLoginNotification,
  sendAssignmentGraded,
  sendExamReleased,
  sendGradeNotification,
  sendExamReleaseNotification,
  getEmailDiagnostics
};
