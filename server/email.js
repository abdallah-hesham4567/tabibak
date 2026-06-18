const nodemailer = require('nodemailer');

let transporter = null;
let directTransporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10000,
    });
  }
  return transporter;
}

function getDirectTransporter() {
  if (!directTransporter) {
    directTransporter = nodemailer.createTransport({ direct: true });
  }
  return directTransporter;
}

async function sendVerificationCode(email, code) {
  const fromName = process.env.EMAIL_FROM_NAME || 'Tabibak';
  const fromAddr = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'noreply@tabibak.app';

  const mailOptions = {
    from: `"${fromName}" <${fromAddr}>`,
    to: email,
    subject: 'Your Tabibak Verification Code',
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#2563eb;">Tabibak</h2>
      <p>Your verification code is:</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#2563eb;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center">${code}</div>
      <p style="color:#666;font-size:14px;">This code expires in 10 minutes.</p>
      <hr style="border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:12px;">If you didn't request this, please ignore this email.</p>
    </div>`,
  };

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const t = getTransporter();
      if (t) {
        await t.sendMail(mailOptions);
        return;
      }
    } catch (e) {
      console.error('SMTP failed, trying direct delivery:', e.message);
    }
  }

  const dt = getDirectTransporter();
  await dt.sendMail(mailOptions);
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendVerificationCode, generateCode };
