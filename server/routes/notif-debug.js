const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.post('/send-test', async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.execute({
      sql: 'SELECT fcmToken FROM users WHERE username = ?',
      args: [req.user.username],
    });
    const fcmToken = user.rows[0]?.fcmToken;
    if (!fcmToken) {
      return res.status(400).json({ error: 'No FCM token registered for your account' });
    }
    const app = req.app.get('fcmApp');
    if (!app) {
      return res.status(500).json({ error: 'Firebase not initialized on server' });
    }
    const { getMessaging } = require('firebase-admin/messaging');
    await getMessaging(app).send({
      token: fcmToken,
      data: {
        type: 'test_notification',
        title: '🔔 طبيبك — الإشعارات تعمل ✅',
        body: 'هذا إشعار تجريبي من الخادم!',
      },
    });
    res.json({ status: 'success', message: 'Test push sent successfully' });
  } catch (err) {
    console.error('Test push failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const result = await db.execute({
      sql: 'SELECT fcmToken, timezoneOffset FROM users WHERE username = ?',
      args: [req.user.username],
    });
    const user = result.rows[0];

    const app = req.app.get('fcmApp');
    const firebaseAdminStatus = app ? 'ok (from scheduler)' : 'not initialized';

    res.json({
      firebaseEnvVarsPresent: {
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      },
      firebaseAdminStatus,
      yourAccount: {
        hasFcmToken: !!(user && user.fcmToken),
        fcmTokenPreview: user && user.fcmToken ? user.fcmToken.slice(0, 12) + '…' : null,
        timezoneOffset: user ? user.timezoneOffset : null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
