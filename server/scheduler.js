const cron = require('node-cron');
const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const { getDb } = require('./db');

let schedulerStarted = false;
let fcmApp = null;

function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
  };

  let fcmReady = false;
  if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
    try {
      if (!admin.apps || admin.apps.length === 0) {
        fcmApp = admin.initializeApp({ credential: admin.cert(serviceAccount) });
      } else {
        fcmApp = admin.apps[0];
      }
      fcmReady = true;
      console.log('Firebase Admin initialized for push notifications');
    } catch (err) {
      console.error('Firebase Admin init failed:', err.message);
    }
  } else {
    console.warn(
      '[scheduler] Firebase credentials not set — push notifications are DISABLED. ' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Railway Variables.'
    );
  }

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const db = await getDb();

      const sql = `
        SELECT md.id AS doseId, md.time AS doseTime,
               (SELECT COUNT(*) - 1 FROM medication_doses md2 WHERE md2.medicationId = md.medicationId AND md2.id <= md.id) AS doseIdx,
               m.id AS medicationId, m.name AS medName, m.dose AS medDose,
               u.username, u.fcmToken, COALESCE(u.timezoneOffset, 3) AS tzOffset
        FROM medication_doses md
        JOIN medications m ON m.id = md.medicationId
        JOIN users u ON u.username = m.username
        WHERE u.fcmToken IS NOT NULL
          AND u.fcmToken != ''
      `;
      const allRows = await db.execute(sql);

      let matchedCount = 0, sentCount = 0, alreadySentCount = 0, failCount = 0;

      // Debug tz values
      const tzSet = new Set(allRows.rows.map(r => Number(r.tzOffset)));
      console.log(`[scheduler] Tick: tz values=${[...tzSet].join(',')} rows=${allRows.rows.length}`);

      for (const row of allRows.rows) {
        const tz = Number(row.tzOffset);
        // Convert now to user local time
        const nowLocal = new Date(now.getTime() + tz * 3600000);
        const nowLocalMins = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();
        // Parse dose time to minutes
        const [dh, dm] = row.doseTime.split(':').map(Number);
        const doseMins = dh * 60 + dm;
        const minsLeft = doseMins - nowLocalMins;
        // Check notification windows
        const windows = [
          { min: 4, max: 6, type: 'medication_reminder', title: `💊 ${row.medName} — خلال 5 دقائق`, body: `الجرعة: ${row.medDose}` },
          { min: -1, max: 1, type: 'medication_due', title: `💊 ${row.medName} — حان الآن`, body: `الجرعة: ${row.medDose}` },
          { min: -6, max: -4, type: 'medication_followup', title: `💊 ${row.medName} — تذكير، لم يتم التأكيد`, body: `الجرعة: ${row.medDose} — هل تناولتها؟` },
        ];

        for (const win of windows) {
          if (minsLeft < win.min || minsLeft >= win.max) continue;
          matchedCount++;

          // For follow-up: skip if already logged as taken
          if (win.type === 'medication_followup') {
            const logCheck = await db.execute({
              sql: 'SELECT id FROM medication_log WHERE username = ? AND medicationId = ? AND doseIdx = ? AND date = ?',
              args: [row.username, row.medicationId, row.doseIdx, today],
            });
            if (logCheck.rows.length > 0) { alreadySentCount++; continue; }
          }

          const alreadySent = await db.execute({
            sql: 'SELECT id FROM notification_log WHERE username = ? AND medicationId = ? AND doseId = ? AND date = ? AND type = ?',
            args: [row.username, row.medicationId, row.doseId, today, win.type],
          });
          if (alreadySent.rows.length > 0) { alreadySentCount++; continue; }

          if (!fcmReady || !fcmApp || !row.fcmToken) {
            failCount++;
            continue;
          }

          try {
            await getMessaging(fcmApp).send({
              token: row.fcmToken,
              data: {
                title: win.title,
                body: win.body,
                medicationId: String(row.medicationId),
                doseTime: String(row.doseTime),
                type: win.type,
              },
            });
            sentCount++;

            await db.execute({
              sql: 'INSERT INTO notification_log (username, medicationId, doseId, doseTime, date, type) VALUES (?, ?, ?, ?, ?, ?)',
              args: [row.username, row.medicationId, row.doseId, row.doseTime, today, win.type],
            });
          } catch (err) {
            failCount++;
            console.error(`[scheduler] FCM failed for ${row.username}:`, err.message);

            if (
              err.code === 'messaging/invalid-registration-token' ||
              err.code === 'messaging/registration-token-not-registered'
            ) {
              await db.execute({
                sql: "UPDATE users SET fcmToken = '' WHERE username = ?",
                args: [row.username],
              });
              console.log(`[scheduler] Cleared stale FCM token for ${row.username}`);
            }
          }
        }
      }

      console.log(
        `[scheduler] Tick: ${allRows.rows.length} users with tokens, ` +
        `${matchedCount} matched, ${sentCount} sent, ` +
        `${alreadySentCount} already sent, ${failCount} failed`
      );
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });

  console.log('Notification scheduler started (every minute)');
  return fcmApp;
}

module.exports = { startScheduler, fcmApp: () => fcmApp };
