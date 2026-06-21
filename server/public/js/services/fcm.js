const firebaseConfig = {
      apiKey: "AIzaSyAEz3mVDyuZCJZwKlBnDuWd1JARbMAI6S0",
      authDomain: "tabibak-b4a37.firebaseapp.com",
      projectId: "tabibak-b4a37",
      storageBucket: "tabibak-b4a37.firebasestorage.app",
      messagingSenderId: "130423014476",
      appId: "1:130423014476:web:03b7cfb841cc48fd1320e9",
      measurementId: "G-YV2DHXCGDH"
    };

    let fcmMessaging = null;
    let fcmInitAttempted = false;

    async function initFcm() {
      if (fcmInitAttempted) return;
      fcmInitAttempted = true;
      if (typeof firebase === 'undefined' || typeof firebase.messaging !== 'function') {
        setTimeout(() => { fcmInitAttempted = false; initFcm(); }, 500);
        return;
      }
      try {
        firebase.initializeApp(firebaseConfig);
        fcmMessaging = firebase.messaging();
        console.log('Firebase initialized for FCM');

        try {
          fcmMessaging.onTokenRefresh(async () => {
            try {
              const currentToken = await fcmMessaging.getToken();
              if (currentToken) {
                const token = getToken();
                if (token) {
                  await api('POST', '/api/notifications/store-token', { fcmToken: currentToken, timezoneOffset: -new Date().getTimezoneOffset() / 60 });
                }
              }
            } catch (err) {
              console.error('FCM token refresh failed:', err);
            }
          });
        } catch (e) {
          console.warn('onTokenRefresh not supported:', e.message);
        }

        fcmMessaging.onMessage((payload) => {
          if (payload.data) {
            new Notification(payload.data.title || 'طبيبك', {
              body: payload.data.body || '',
              icon: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
            });
          }
        });
      } catch (e) {
        console.warn('Firebase init failed:', e.message);
      }
    }

    initFcm();

    async function registerFcmServiceWorker() {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;
      try {
        // Register — if already registered, this won't re-register unless the SW changed
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        // Wait until the SW is actually active and controlling the page
        const registration = await navigator.serviceWorker.ready;
        console.log('FCM service worker ready:', registration.active?.state);
        return registration;
      } catch (err) {
        console.error('FCM service worker registration failed:', err);
        fcmLastError = 'SW: ' + err.message;
        return null;
      }
    }

    async function requestFcmToken(useVapidKey = true) {
      if (typeof firebase === 'undefined' || typeof firebase.messaging !== 'function') {
        fcmLastError = 'مكتبة Firebase لم تُحمّل بعد';
        setTimeout(() => { fcmLastError = null; requestFcmToken(); }, 1000);
        return;
      }
      if (!fcmMessaging) {
        try {
          firebase.initializeApp(firebaseConfig);
          fcmMessaging = firebase.messaging();
        } catch (e) {
          fcmLastError = e.message || 'تعذر تهيئة Firebase';
          setTimeout(() => { fcmLastError = null; requestFcmToken(); }, 1000);
          return;
        }
      }
      try {
        const registration = await registerFcmServiceWorker();
        const vapidKey = 'BKxhGi3SO7NZIMHUL6SRm2cYXz51ftQWAHhcGftmCHvWnEzvq-w0E-yTE-_bf9BabxoH7F4MmQ4N26uCVmInM3w';
        const currentToken = await fcmMessaging.getToken({
          ...(useVapidKey ? { vapidKey } : {}),
          ...(registration ? { serviceWorkerRegistration: registration } : {}),
        });
        if (currentToken) {
          console.log('FCM token obtained');
          fcmLastError = null;
          const token = getToken();
          if (token) {
            await api('POST', '/api/notifications/store-token', { fcmToken: currentToken });
          }
        } else {
          fcmLastError = 'لم يتم الحصول على رمز (getToken أعادت فارغاً)';
        }
      } catch (err) {
        const detail = err.code ? `[${err.code}] ` : '';
        fcmLastError = detail + (err.message || 'فشل الحصول على رمز FCM');
        console.error('FCM getToken failed:', err);
        if (useVapidKey) {
          console.log('Retrying FCM token without VAPID key...');
          setTimeout(() => requestFcmToken(false), 1000);
        }
      }
    }

    let fcmLastError = null;

    /* ------ FCM server-side diagnostic ------ */
    async function checkFcmServerStatus() {
      const el = document.getElementById('fcmServerStatus');
      if (!el) return;
      try {
        const data = await api('GET', '/api/notif-debug');
        const envOk = data.firebaseEnvVarsPresent?.FIREBASE_PROJECT_ID
          && data.firebaseEnvVarsPresent?.FIREBASE_CLIENT_EMAIL
          && data.firebaseEnvVarsPresent?.FIREBASE_PRIVATE_KEY;
        const hasToken = data.yourAccount?.hasFcmToken;
        const parts = [];
        if (envOk) {
          parts.push('<span style="color:var(--green)"><i class="ti ti-server"></i> الخادم جاهز</span>');
        } else {
          parts.push('<span style="color:var(--red)"><i class="ti ti-server-off"></i> الخادم غير مهيئ — الإشعارات عند إغلاق التبويب غير ممكنة</span>');
        }
        if (data.firebaseAdminStatus) {
          const adminOk = data.firebaseAdminStatus.startsWith('ok');
          parts.push('<span style="color:' + (adminOk ? 'var(--green)' : 'var(--red)') + ';font-size:0.75rem;">Firebase Admin: ' + data.firebaseAdminStatus + '</span>');
        }
        if (hasToken) {
          parts.push('<span style="color:var(--green)"><i class="ti ti-key"></i> رمز الإشعار مسجل</span>');
          parts.push('<button class="btn btn-sm" id="sendTestPushBtn" style="padding:0.3rem 0.8rem;font-size:0.8rem;cursor:pointer;"><i class="ti ti-send"></i> إرسال اختبار push</button>');
        } else {
          parts.push('<span style="color:var(--orange)"><i class="ti ti-key-off"></i> رمز الإشعار غير مسجل</span>');
          if (Notification.permission === 'granted' && STATE.currentUser) {
            parts.push('<button class="btn btn-sm" id="fcmRetryBtn" style="padding:0.3rem 0.8rem;font-size:0.8rem;cursor:pointer;"><i class="ti ti-refresh"></i> إعادة التسجيل</button>');
          }
        }
        if (fcmLastError) {
          parts.push('<br><span style="color:var(--red);font-size:0.75rem;">⚠️ ' + fcmLastError + '</span>');
        }
        // Check service worker and test push subscription
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          const allRegs = await navigator.serviceWorker.getRegistrations().catch(() => []);
          let swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').catch(() => null);
          if (!swReg && allRegs.length > 0) {
            swReg = allRegs[0];
            parts.push('<br><span style="font-size:0.75rem;color:var(--orange);">SW found at: ' + (swReg.scope || '?') + '</span>');
          }
          if (swReg && swReg.active) {
            parts.push('<br><span style="font-size:0.75rem;color:var(--text-muted);">SW: ' + swReg.active.state + ' (scope: ' + swReg.scope + ')</span>');
            // Test push subscription to show raw browser error
            if (!hasToken) {
              const pushTest = await swReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'BKxhGi3SO7NZIMHUL6SRm2cYXz51ftQWAHhcGftmCHvWnEzvq-w0E-yTE-_bf9BabxoH7F4MmQ4N26uCVmInM3w',
              }).then(sub => {
                sub.unsubscribe();
                return null;
              }).catch(e => e.name + ': ' + e.message);
              if (pushTest) {
                parts.push('<br><span style="font-size:0.75rem;color:var(--red);">PushManager: ' + pushTest + '</span>');
              }
            }
          } else {
            parts.push('<br><span style="font-size:0.75rem;color:var(--orange);">SW: ' + (swReg && !swReg.active ? 'installing/ waiting' : 'غير مسجلة') + '</span>');
            if (allRegs.length === 0) parts.push(' (no SW at all)');
          }
        }
        el.innerHTML = parts.join(' &nbsp;|&nbsp; ');
        el.style.display = 'block';
        const retryBtn = document.getElementById('fcmRetryBtn');
        if (retryBtn) {
          retryBtn.addEventListener('click', async () => {
            retryBtn.disabled = true;
            retryBtn.textContent = '⏳ جاري التسجيل...';
            await requestFcmToken();
            checkFcmServerStatus();
          });
        }
        const testBtn = document.getElementById('sendTestPushBtn');
        if (testBtn) {
          testBtn.addEventListener('click', async () => {
            testBtn.disabled = true;
            testBtn.textContent = '⏳ جاري الإرسال...';
            try {
              await api('POST', '/api/notif-debug/send-test');
              testBtn.textContent = '✅ أُرسل!';
            } catch (err) {
              testBtn.textContent = '❌ فشل: ' + (err.message || 'خطأ');
            }
            setTimeout(() => testBtn.textContent = 'إرسال اختبار push', 3000);
            testBtn.disabled = false;
          });
        }
      } catch (err) {
        el.textContent = '⚠️ تعذر التحقق من حالة الخادم';
        el.style.display = 'block';
      }
    }

    /* ------ Wire the toggle / enable / test buttons ------ */
    document.getElementById('fcmToggle').addEventListener('click', () => {
      const panel = document.getElementById('fcmPanel');
      const btn = document.getElementById('fcmToggle');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      panel.style.display = isOpen ? 'none' : '';
      if (!isOpen) { refreshNotifSettingsUi(); checkFcmServerStatus(); }
    });

    document.getElementById('fcmEnableBtn').addEventListener('click', requestNotifPermission);
    document.getElementById('fcmTestBtn').addEventListener('click', triggerTestNotification);

    // Listen for messages from the service worker (e.g. notification click -> show meds)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.action === 'showMeds') {
          showTab('meds');
        }
      });
    }
