const nodemailer = require('nodemailer');

async function sendVerificationCode(email, code) {
  const fromName = process.env.EMAIL_FROM_NAME || 'Tabibak';
  const fromAddr = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'noreply@tabibak.app';

  const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#2563eb;">Tabibak</h2>
    <p>Your verification code is:</p>
    <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#2563eb;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center">${code}</div>
    <p style="color:#666;font-size:14px;">This code expires in 10 minutes.</p>
    <hr style="border:none;border-top:1px solid #eee"/>
    <p style="color:#999;font-size:12px;">If you didn't request this, please ignore this email.</p>
  </div>`;

  // Try SendGrid HTTP API first (port 443, always works)
  const sgKey = process.env.SENDGRID_API_KEY;
  if (sgKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + sgKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: fromAddr, name: fromName },
          subject: 'Your Tabibak Verification Code',
          content: [
            { type: 'text/plain', value: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.` },
            { type: 'text/html', value: html },
          ],
        }),
      });
      if (res.ok) return;
      const errText = await res.text();
      console.error('SendGrid API error:', res.status, errText);
    } catch (e) {
      console.error('SendGrid request failed:', e.message);
    }
  }

  // Fallback: try Gmail SMTP
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (user && pass) {
    try {
      const t = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 10000,
      });
      await t.sendMail({
        from: `"${fromName}" <${fromAddr}>`,
        to: email,
        subject: 'Your Tabibak Verification Code',
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        html,
      });
      return;
    } catch (e) {
      console.error('SMTP failed:', e.message);
    }
  }

  throw new Error('Cannot send email. Set SENDGRID_API_KEY or configure SMTP_USER/SMTP_PASS.');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { sendVerificationCode, generateCode };
