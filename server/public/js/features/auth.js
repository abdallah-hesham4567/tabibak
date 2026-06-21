document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.form).classList.add('active');
      });
    });

    document.getElementById('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;

      if (!u) { alert('يرجى إدخال اسم المستخدم.'); return; }
      if (!p) { alert('يرجى إدخال كلمة المرور.'); return; }

      try {
        const data = await api('POST', '/api/auth/login', { username: u, password: p, timezoneOffset: -new Date().getTimezoneOffset() / 60 });
        setToken(data.token);
        STATE.currentUser = data;
        STATE.sessions = await api('GET', '/api/sessions');
        try { STATE.meds.list = await api('GET', '/api/medications'); } catch (e) { STATE.meds.list = []; }
        try { await loadMentorData(); } catch (e) {}
        if (Notification.permission === 'granted') {
          startReminderScheduler();
          requestFcmToken();
        } else if (Notification.permission !== 'denied') {
          showNotificationModal();
        }
        refreshProfileScreen();
        showTab('profile');
      } catch (err) {
        alert('اسم المستخدم أو كلمة المرور غير صحيحة.');
      }
    });

    // Live validation for password constraints
    const regPassInput = document.getElementById('regPass');
    const regConfirmPassInput = document.getElementById('regConfirmPass');

    function checkPasswordConstraints() {
      const p = regPassInput.value;
      const constraints = {
        conLength: p.length >= 8,
        conUpper: /[A-Z]/.test(p),
        conLower: /[a-z]/.test(p),
        conDigit: /\d/.test(p),
        conSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p)
      };

      for (const [id, isValid] of Object.entries(constraints)) {
        const el = document.getElementById(id);
        if (el) {
          const iconClass = isValid ? 'ti-circle-check' : 'ti-circle-x';
          const text = id === 'conLength' ? ' 8 أحرف على الأقل'
            : id === 'conUpper' ? ' حرف كبير واحد على الأقل (A-Z)'
              : id === 'conLower' ? ' حرف صغير واحد على الأقل (a-z)'
                : id === 'conDigit' ? ' رقم واحد على الأقل (0-9)'
                  : ' رمز خاص واحد على الأقل (!@#$%^&...)';
          el.className = `constraint-item ${isValid ? 'valid' : 'invalid'}`;
          el.innerHTML = `<i class="ti ${iconClass}"></i>${text}`;
        }
      }
      return Object.values(constraints).every(Boolean);
    }

    if (regPassInput) {
      regPassInput.addEventListener('input', checkPasswordConstraints);
    }

    // Toggle password visibility
    function setupPasswordToggle(inputId, toggleId) {
      const input = document.getElementById(inputId);
      const toggle = document.getElementById(toggleId);
      if (input && toggle) {
        toggle.addEventListener('click', () => {
          const isPass = input.type === 'password';
          input.type = isPass ? 'text' : 'password';
          const icon = toggle.querySelector('i');
          if (icon) {
            icon.className = isPass ? 'ti ti-eye-off' : 'ti ti-eye';
          }
        });
      }
    }

    setupPasswordToggle('regPass', 'toggleRegPass');
    setupPasswordToggle('regConfirmPass', 'toggleRegConfirmPass');

    document.getElementById('registerForm').addEventListener('submit', async e => {
      e.preventDefault();
      const u = document.getElementById('regUser').value.trim();
      const p = document.getElementById('regPass').value;
      const cp = document.getElementById('regConfirmPass').value;
      const n = document.getElementById('regName').value.trim();
      const a = document.getElementById('regAge').value;
      const g = document.getElementById('regGender').value;
      const mob = document.getElementById('regMobile').value.trim();
      const h = document.getElementById('regHistory').value.trim();

      if (!u || !p || !cp || !n || !a || !g || !mob) {
        alert('يرجى ملء جميع الحقول المطلوبة بما في ذلك رقم الموبايل وتأكيد كلمة المرور.');
        return;
      }
      if (u.length < 4) {
        alert('يجب أن يتكون اسم المستخدم من 4 أحرف على الأقل.');
        return;
      }
      if (!checkPasswordConstraints()) {
        alert('يجب أن تفي كلمة المرور بجميع الشروط الأمنية المحددة.');
        return;
      }
      if (p !== cp) {
        alert('كلمتا المرور غير متطابقتين.');
        return;
      }
      const ageNum = parseInt(a, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) { alert('يرجى إدخال عمر صحيح يتراوح بين 1 و120 عاماً.'); return; }
      const mobileRegex = /^\+?[0-9]{10,15}$/;
      if (!mobileRegex.test(mob)) {
        alert('يرجى إدخال رقم هاتف محمول صحيح (يتكون من 10 إلى 15 رقماً).');
        return;
      }

      try {
        const data = await api('POST', '/api/auth/register', { username: u, password: p, name: n, age: a, gender: g, mobile: mob, history: h, timezoneOffset: -new Date().getTimezoneOffset() / 60 });
        setToken(data.token);
        STATE.currentUser = data;
        showNotificationModal();
      } catch (err) {
        alert(err.message || 'فشل التسجيل. يرجى المحاولة مرة أخرى.');
      }
    });
