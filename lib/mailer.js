const nodemailer = require('nodemailer');

// Generic SMTP transport so this works with Gmail (app password), Resend,
// SendGrid, or any other provider's SMTP relay without code changes —
// point SMTP_HOST/PORT/USER/PASS at whichever one you've set up.
let transporter = null;
let warnedNoTransport = false;

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    if (!warnedNoTransport) {
      console.warn('SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS not fully set — email alerts are disabled.');
      warnedNoTransport = true;
    }
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

function getRecipients() {
  const raw = process.env.ALERT_RECIPIENTS;
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function sendMail({ subject, text, html }) {
  const t = getTransporter();
  const recipients = getRecipients();

  if (!t || recipients.length === 0) {
    console.warn(`Email not sent (SMTP not configured or ALERT_RECIPIENTS empty): ${subject}`);
    return { sent: false };
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients.join(', '),
    subject,
    text,
    html,
  });
  return { sent: true };
}

module.exports = { sendMail, getRecipients };
