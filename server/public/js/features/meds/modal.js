let currentDoseCount = 1;

    function getDefaultDoseTime(index, total) {
      if (total === 1) return '08:00';
      if (total === 2) return index === 0 ? '08:00' : '20:00';
      if (total === 3) return index === 0 ? '08:00' : index === 1 ? '14:00' : '20:00';
      if (total === 4) return ['08:00', '12:00', '18:00', '22:00'][index];
      if (total === 5) return ['07:00', '10:00', '13:00', '17:00', '21:00'][index];
      return '08:00';
    }

    function renderDoseSlots(count) {
      const container = document.getElementById('doseSlotContainer');
      container.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const row = document.createElement('div');
        row.className = 'dose-slot-row';
        row.innerHTML = `
          <span class="dose-slot-label">الجرعة ${i + 1}</span>
          <input type="time" id="doseTime_${i}" step="60" value="${getDefaultDoseTime(i, count)}" />
        `;
        container.appendChild(row);
      }
    }

    document.getElementById('medsAddBtn').addEventListener('click', () => {
      currentDoseCount = 1;
      document.getElementById('doseCountDisplay').textContent = '1';
      document.getElementById('medNameInput').value = '';
      document.getElementById('medDoseInput').value = '';
      document.getElementById('medNoteInput').value = '';
      document.getElementById('medUrgentInput').value = 'no';
      renderDoseSlots(1);
      document.getElementById('medsModalOverlay').classList.add('open');
    });

    document.getElementById('doseCountMinus').addEventListener('click', () => {
      if (currentDoseCount > 1) {
        currentDoseCount--;
        document.getElementById('doseCountDisplay').textContent = currentDoseCount;
        renderDoseSlots(currentDoseCount);
      }
    });

    document.getElementById('doseCountPlus').addEventListener('click', () => {
      if (currentDoseCount < 6) {
        currentDoseCount++;
        document.getElementById('doseCountDisplay').textContent = currentDoseCount;
        renderDoseSlots(currentDoseCount);
      }
    });

    document.getElementById('medsCancelBtn').addEventListener('click', () => {
      document.getElementById('medsModalOverlay').classList.remove('open');
    });

    document.getElementById('medsModalOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('medsModalOverlay')) {
        document.getElementById('medsModalOverlay').classList.remove('open');
      }
    });

    document.getElementById('medsSaveBtn').addEventListener('click', async () => {
      const name = document.getElementById('medNameInput').value.trim();
      const dose = document.getElementById('medDoseInput').value.trim();
      const form = document.getElementById('medFormInput').value;
      const food = document.getElementById('medFoodInput').value;
      const urgent = document.getElementById('medUrgentInput').value === 'yes';
      const note = document.getElementById('medNoteInput').value.trim();

      if (!name) { alert('يرجى إدخال اسم الدواء.'); return; }
      if (!dose) { alert('يرجى إدخال جرعة الدواء.'); return; }

      const doses = [];
      for (let i = 0; i < currentDoseCount; i++) {
        const timeInput = document.getElementById(`doseTime_${i}`);
        const rawTime = timeInput ? timeInput.value : '08:00';
        doses.push({ time: roundTo5Min(rawTime) });
      }
      const colorIdx = STATE.meds.list.length % PILL_COLORS.length;
      const newMed = {
        id: String(Date.now()),
        name,
        dose: dose || '—',
        form,
        doseCount: currentDoseCount,
        doses,
        food,
        urgent,
        note,
        icon: getIconForForm(form),
        color: PILL_COLORS[colorIdx],
      };

      if (STATE.currentUser) {
        try { await api('POST', '/api/medications', newMed); } catch (e) { alert('Failed to save medication'); return; }
      }
      STATE.meds.list.push(newMed);
      saveStorage();
      document.getElementById('medsModalOverlay').classList.remove('open');
      renderMedsScreen();
    });

    /* ================================================================
       BROWSER PUSH NOTIFICATIONS — REMINDER SCHEDULER
       No Firebase, no external service.
       Works natively in the browser. Tab must stay open.
       ================================================================ */

    // Tracks the setInterval handle so we never start it twice
    let reminderIntervalHandle = null;

    /* ------ Update the notification settings panel UI ------ */
    function refreshNotifSettingsUi() {
      const statusEl = document.getElementById('fcmStatusText');
      const enableBtn = document.getElementById('fcmEnableBtn');
      const testBtn = document.getElementById('fcmTestBtn');
      if (!statusEl) return;

      if (!('Notification' in window)) {
        statusEl.textContent = '❌ الإشعارات غير مدعومة في هذا المتصفح';
        enableBtn.style.display = 'none';
        testBtn.style.display = 'none';
        return;
      }

      if (Notification.permission === 'granted') {
        statusEl.innerHTML = '<i class="ti ti-circle-check "></i> مفعّلة — التذكيرات نشطة';
        statusEl.style.color = 'var(--green)';
        enableBtn.style.display = 'none';
        testBtn.style.display = 'inline-block';
        startReminderScheduler();
      } else if (Notification.permission === 'denied') {
        statusEl.innerHTML = '<i class="ti ti-lock"></i> محجوبة — اسمح بالإشعارات من إعدادات المتصفح';
        statusEl.style.color = 'var(--red)';
        enableBtn.disabled = true;
        testBtn.style.display = 'none';
      } else {
        statusEl.innerHTML = '<i class="ti ti-player-pause"></i> غير مفعّلة — انقر لتفعيل التذكيرات';
        statusEl.style.color = 'var(--orange)';
        enableBtn.disabled = false;
        testBtn.style.display = 'none';
      }
    }

    /* ------ Ask for permission then start scheduler ------ */
    async function requestNotifPermission() {
      if (!('Notification' in window)) {
        alert('الإشعارات غير مدعومة في هذا المتصفح.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        startReminderScheduler();
        requestFcmToken();
        document.getElementById('notificationModal').classList.remove('open');
        alert('✓ تم تفعيل التذكيرات! ستصلك إشعارات قبل 5 دقائق من موعد كل جرعة.');
      } else {
        alert('تم رفض إذن الإشعارات. يمكنك تفعيله من إعدادات المتصفح.');
      }
      refreshNotifSettingsUi();
    }

    /* ------ Fire a test notification right now ------ */
    function triggerTestNotification() {
      if (Notification.permission !== 'granted') {
        alert('يرجى تفعيل الإشعارات أولاً.');
        return;
      }
      new Notification('💊 طبيبك — اختبار التذكير', {
        body: 'هذا إشعار تجريبي. ستصلك تذكيرات حقيقية قبل 5 دقائق من كل جرعة.',
        icon: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
        tag: 'tabibak-test',
      });
    }

    /* ------ The scheduler: checks every 60 seconds ------ */
    function startReminderScheduler() {
      if (reminderIntervalHandle) return; // already running

      reminderIntervalHandle = setInterval(() => {
        if (Notification.permission !== 'granted') return;

        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        STATE.meds.list.forEach(med => {
          // Support both old single-time and new multi-dose format
          const doses = med.doses && med.doses.length ? med.doses : [{ time: med.time || '08:00' }];

          doses.forEach((dose, idx) => {
            const [dh, dm] = (dose.time || '08:00').split(':').map(Number);
            const doseMins = dh * 60 + dm;
            const minsLeft = doseMins - nowMins;

            const takenKey = `${med.id}_${idx}`;

            // 1) 5 minutes before dose
            if (minsLeft >= 4.5 && minsLeft < 5.5) {
              const fireKey = `notif_${med.id}_dose${idx}_${now.toDateString()}`;
              if (!sessionStorage.getItem(fireKey)) {
                sessionStorage.setItem(fireKey, '1');
                new Notification(`💊 تذكير دواء — ${med.name}`, {
                  body: `حان وقت جرعة ${med.name} (${med.dose}) خلال 5 دقائق — الموعد: ${dose.time}`,
                  icon: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
                  tag: fireKey,
                  requireInteraction: true,
                });
              }
            }

            // 2) At the dose time
            if (minsLeft >= -0.5 && minsLeft < 0.5) {
              const fireKey = `notif_now_${med.id}_dose${idx}_${now.toDateString()}`;
              if (!sessionStorage.getItem(fireKey)) {
                sessionStorage.setItem(fireKey, '1');
                new Notification(`💊 حان الآن موعد دواء — ${med.name}`, {
                  body: `حان الآن موعد جرعة ${med.name} (${med.dose})`,
                  icon: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
                  tag: fireKey,
                  requireInteraction: true,
                });
              }
            }

            // 3) 5 minutes after dose (only if not marked as taken)
            if (minsLeft >= -5.5 && minsLeft < -4.5) {
              const fireKey = `notif_remind_${med.id}_dose${idx}_${now.toDateString()}`;
              if (!sessionStorage.getItem(fireKey) && !STATE.meds.taken[takenKey]) {
                sessionStorage.setItem(fireKey, '1');
                new Notification(`💊 تذكير — دواء ${med.name}`, {
                  body: `لم يتم تأكيد جرعة ${med.name} (${med.dose}) — هل تناولتها؟`,
                  icon: 'https://cdn-icons-png.flaticon.com/512/1930/1930985.png',
                  tag: fireKey,
                  requireInteraction: true,
                });
              }
            }
          });
        });
      }, 60_000); // check every 60 seconds

      console.log('⏰ Tabibak reminder scheduler started');
    }
