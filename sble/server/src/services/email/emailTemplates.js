const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const wrapEmailLayout = ({ title, preheader, bodyHtml }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e7ecf5;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 28px 12px;background:linear-gradient(135deg,#4f8ef7 0%,#3b6fd4 100%);color:#ffffff;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Secure Blended Learning</p>
              <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:700;">SBLE</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid #edf1f7;background:#fafbfe;font-size:12px;line-height:1.6;color:#667085;">
              <p style="margin:0;">This message was sent by the Secure Blended Learning Environment (SBLE).</p>
              <p style="margin:8px 0 0;">If you did not request this email, you can safely ignore it or contact your institution&apos;s IT support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const buildPasswordResetEmail = ({ recipientName, resetUrl, expiryMinutes }) => {
  const safeName = escapeHtml(recipientName || 'there');
  const safeUrl = escapeHtml(resetUrl);
  const minutes = Number(expiryMinutes) || 30;

  const bodyHtml = `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1f2937;">Reset your password</h2>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467;">
      Hello <strong>${safeName}</strong>, we received a request to reset the password for your SBLE account.
    </p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475467;">
      Use the button below to choose a new password. For your security, this link expires in <strong>${minutes} minutes</strong> and can only be used once.
    </p>
    <p style="margin:0 0 24px;text-align:center;">
      <a href="${safeUrl}" style="display:inline-block;background:#4f8ef7;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">
        Reset password
      </a>
    </p>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#667085;">
      If the button does not work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all;color:#4f8ef7;">
      <a href="${safeUrl}" style="color:#4f8ef7;">${safeUrl}</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#667085;">
      If you did not request a password reset, no action is required. Your password will remain unchanged.
    </p>
  `;

  return wrapEmailLayout({
    title: 'Reset your SBLE password',
    preheader: `Password reset link — expires in ${minutes} minutes`,
    bodyHtml
  });
};

module.exports = {
  escapeHtml,
  wrapEmailLayout,
  buildPasswordResetEmail
};
