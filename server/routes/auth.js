const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { getDb } = require('../db');
const { generateToken, authenticateToken } = require('../auth');
const { sendVerificationCode, generateCode } = require('../email');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/register', async (req, res) => {
  try {
    const { username, password, name, age, gender, mobile, history, timezoneOffset } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password, and name are required' });
    }
    const db = await getDb();
    const existing = await db.execute({ sql: 'SELECT username FROM users WHERE username = ?', args: [username] });
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.execute({
      sql: 'INSERT INTO users (username, passwordHash, name, age, gender, mobile, history, timezoneOffset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [username, passwordHash, name, age || null, gender || null, mobile || null, history || '', timezoneOffset ?? 0],
    });
    const token = generateToken(username);
    res.status(201).json({ token, username, name, timezoneOffset: timezoneOffset ?? 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password, timezoneOffset } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const db = await getDb();
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (timezoneOffset !== undefined) {
      await db.execute({
        sql: 'UPDATE users SET timezoneOffset = ? WHERE username = ?',
        args: [timezoneOffset, username],
      });
    }
    const token = generateToken(username);
    const { passwordHash, ...profile } = user;
    profile.timezoneOffset = timezoneOffset ?? user.timezoneOffset ?? 0;
    res.json({ token, ...profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function sendViaGmailApi(accessToken, to, subject, text, html) {
  const boundary = '----=_Part_' + Date.now();
  const raw = [
    `From: Tabibak <${to}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    '',
    text,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    '',
    html,
    `--${boundary}--`,
  ].join('\r\n');
  const encoded = Buffer.from(raw).toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Gmail API error: ' + errText);
  }
}

router.post('/google', async (req, res) => {
  try {
    const { credential, accessToken } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential required' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    const db = await getDb();
    const existing = await db.execute({
      sql: 'SELECT * FROM users WHERE googleId = ? OR email = ?',
      args: [googleId, email],
    });

    const code = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      await db.execute({
        sql: 'UPDATE users SET verificationCode = ?, verificationCodeExpires = ? WHERE username = ?',
        args: [code, expires, user.username],
      });
    } else {
      let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      let username = baseUsername;
      let suffix = 1;
      while (true) {
        const check = await db.execute({
          sql: 'SELECT username FROM users WHERE username = ?',
          args: [username],
        });
        if (check.rows.length === 0) break;
        username = `${baseUsername}${suffix}`;
        suffix++;
      }
      const passwordHash = bcrypt.hashSync(googleId, 10);
      await db.execute({
        sql: 'INSERT INTO users (username, passwordHash, name, email, googleId, emailVerified) VALUES (?, ?, ?, ?, ?, 0)',
        args: [username, passwordHash, name || email.split('@')[0], email, googleId],
      });
    }

    // Get the username (either existing or newly created)
    const userRow = await db.execute({
      sql: 'SELECT username FROM users WHERE googleId = ? OR email = ?',
      args: [googleId, email],
    });
    const username = userRow.rows[0].username;

    console.log(`Verification code for ${email}: ${code}`);

    // Try Gmail API with access token first (port 443, always works)
    if (accessToken) {
      try {
        const text = `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`;
        const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#2563eb;">Tabibak</h2>
          <p>Your verification code is:</p>
          <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#2563eb;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center">${code}</div>
          <p style="color:#666;font-size:14px;">This code expires in 10 minutes.</p>
          <hr style="border:none;border-top:1px solid #eee"/>
          <p style="color:#999;font-size:12px;">If you didn't request this, please ignore this email.</p>
        </div>`;
        await sendViaGmailApi(accessToken, email, 'Your Tabibak Verification Code', text, html);
        return res.json({ needsVerification: true, email, username, sent: true });
      } catch (e) {
        console.error('Gmail API failed:', e.message);
      }
    }

    // Fallback: try other email methods
    let sent = false;
    try {
      await sendVerificationCode(email, code);
      sent = true;
    } catch (e) {
      console.error('Email fallback failed:', e.message);
    }

    if (sent) {
      res.json({ needsVerification: true, email, username, sent: true });
    } else {
      // Email not sent — return JWT directly (Google already verified the email)
      await db.execute({
        sql: 'UPDATE users SET emailVerified = 1 WHERE username = ?',
        args: [username],
      });
      const fullUser = await db.execute({
        sql: 'SELECT * FROM users WHERE username = ?',
        args: [username],
      });
      const user = fullUser.rows[0];
      const token = generateToken(username);
      const { passwordHash, verificationCode, verificationCodeExpires, ...profile } = user;
      profile.emailVerified = 1;
      res.json({ token, ...profile });
    }
  } catch (err) {
    console.error('Google login error:', err);
    res.status(401).json({ error: err.message || 'Invalid Google credential' });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { username, code } = req.body;
    if (!username || !code) {
      return res.status(400).json({ error: 'Username and code are required' });
    }
    const db = await getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE username = ?',
      args: [username],
    });
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.verificationCode || !user.verificationCodeExpires) {
      return res.status(400).json({ error: 'No verification code sent. Please login again.' });
    }
    if (user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    if (new Date(user.verificationCodeExpires) < new Date()) {
      return res.status(400).json({ error: 'Verification code expired. Please login again.' });
    }

    await db.execute({
      sql: 'UPDATE users SET emailVerified = 1, verificationCode = \'\', verificationCodeExpires = \'\' WHERE username = ?',
      args: [username],
    });

    const token = generateToken(username);
    const { passwordHash, verificationCode, verificationCodeExpires, ...profile } = user;
    profile.emailVerified = 1;
    res.json({ token, ...profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [req.user.username] });
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash, ...profile } = user;
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, age, gender, mobile, history, timezoneOffset } = req.body;
    const db = await getDb();
    await db.execute({
      sql: 'UPDATE users SET name = ?, age = ?, gender = ?, mobile = ?, history = ?, timezoneOffset = ? WHERE username = ?',
      args: [name, age || null, gender || null, mobile || null, history || '', timezoneOffset ?? 0, req.user.username],
    });
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/avatar', authenticateToken, async (req, res) => {
  try {
    const { avatar } = req.body;
    const db = await getDb();
    await db.execute({
      sql: 'UPDATE users SET avatar = ? WHERE username = ?',
      args: [avatar || '', req.user.username],
    });
    res.json({ message: 'Avatar updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
