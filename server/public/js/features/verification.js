document.getElementById('verifyCodeBtn').addEventListener('click', async () => {
      const code = document.getElementById('verificationCodeInput').value.trim();
      const user = STATE.pendingGoogleUser;
      if (!code || code.length !== 6) {
        document.getElementById('verificationError').textContent = 'يرجى إدخال رمز التحقق المكون من 6 أرقام.';
        document.getElementById('verificationError').style.display = '';
        return;
      }
      try {
        const data = await api('POST', '/api/auth/verify-code', { username: user.username, code });
        setToken(data.token);
        STATE.currentUser = data;
        STATE.sessions = await api('GET', '/api/sessions');
        try { STATE.meds.list = await api('GET', '/api/medications'); } catch (e) { STATE.meds.list = []; }
        try { await loadMentorData(); } catch (e) {}
        if (Notification.permission === 'granted') { startReminderScheduler(); requestFcmToken(); }
        document.getElementById('verificationModal').classList.remove('open');
        STATE.pendingGoogleUser = null;
        refreshProfileScreen();
        showTab('profile');
      } catch (err) {
        document.getElementById('verificationError').textContent = err.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية.';
        document.getElementById('verificationError').style.display = '';
      }
    });

    document.getElementById('verificationModalClose').addEventListener('click', () => {
      document.getElementById('verificationModal').classList.remove('open');
      STATE.pendingGoogleUser = null;
    });

    document.getElementById('verificationModal').addEventListener('click', e => {
      if (e.target === document.getElementById('verificationModal')) {
        document.getElementById('verificationModal').classList.remove('open');
        STATE.pendingGoogleUser = null;
      }
    });

    function updateFoodContextBar() {
      const bar = document.getElementById('foodUserContextBar');
      if (!bar) return;

      const user = STATE.currentUser;
      const bmi = STATE.bmi;
      const medsCount = STATE.meds?.list?.length || 0;
      const breath = STATE.breathing?.breathResult;

      if (!user && !bmi && medsCount === 0 && !breath) {
        bar.style.display = 'none';
        return;
      }

      bar.style.display = 'flex';

      // User Profile
      const uEl = document.getElementById('fucUser');
      if (user) {
        let txt = user.name || 'مريض';
        if (user.age) txt += ` (${user.age} سنة)`;
        uEl.textContent = txt;
        uEl.parentElement.style.display = '';
      } else {
        uEl.parentElement.style.display = 'none';
      }

      // BMI
      const bmiEl = document.getElementById('fucBmi');
      if (bmi) {
        bmiEl.textContent = `${bmi.value} (${bmi.category})`;
        bmiEl.parentElement.style.display = '';
      } else {
        bmiEl.parentElement.style.display = 'none';
      }

      // Meds
      const medsEl = document.getElementById('fucMeds');
      if (medsCount > 0) {
        medsEl.textContent = `${medsCount} أدوية نشطة`;
        medsEl.parentElement.style.display = '';
      } else {
        medsEl.parentElement.style.display = 'none';
      }

      // Breathing Test
      const breathEl = document.getElementById('fucBreath');
      if (breath) {
        breathEl.textContent = `${breath.score}/10 (${breath.title})`;
        breathEl.parentElement.style.display = '';
      } else {
        breathEl.parentElement.style.display = 'none';
      }

      // Hide dividers if necessary
      const children = Array.from(bar.children);
      children.forEach((child) => {
        if (child.classList.contains('context-divider')) {
          child.style.display = 'none'; // reset
        }
      });

      // Set correct visible dividers
      let visibleItems = children.filter(c => !c.classList.contains('context-divider') && c.style.display !== 'none');
      children.forEach(c => {
        if (c.classList.contains('context-divider')) {
          const prev = c.previousElementSibling;
          const next = c.nextElementSibling;
          if (prev && prev.style.display !== 'none' && next && next.style.display !== 'none') {
            const followingVisible = visibleItems.filter(item => children.indexOf(item) > children.indexOf(c));
            if (followingVisible.length > 0) {
              c.style.display = '';
            }
          }
        }
      });
    }
