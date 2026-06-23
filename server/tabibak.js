    /* ================================================================
       WELCOME SCREEN ANIMATION
       ================================================================ */
    function startWelcomeAnimation() {
      const text = "أهلاً بك في طبيبك ✨ نتمنى لك الشفاء العاجل ❤️🩺";
      const container = document.getElementById('welcomeTextContainer');
      if (!container) return;

      const words = text.split(" ");
      container.innerHTML = words.map(w => {
        const isHighlight = w.includes("طبيبك") || w.includes("الشفاء");
        const cls = isHighlight ? "welcome-word welcome-word-highlight" : "welcome-word";
        return `<span class="${cls}">${w}</span>`;
      }).join(" ");

      setTimeout(() => {
        const bar = document.getElementById('welcomeProgressBar');
        if (bar) bar.style.width = '100%';
      }, 50);

      const wordSpans = container.querySelectorAll('.welcome-word');
      wordSpans.forEach((span, idx) => {
        setTimeout(() => {
          span.classList.add('visible');
        }, idx * 250 + 100);
      });

      setTimeout(() => {
        const welcome = document.getElementById('welcomeScreen');
        if (welcome) {
          welcome.classList.add('fade-out');
          setTimeout(() => {
            welcome.remove();
          }, 800);
        }
      }, 5000);
    }

    startWelcomeAnimation();

    // Tap/click anywhere on welcome screen to skip intro immediately
    document.getElementById('welcomeScreen')?.addEventListener('click', dismissWelcome);
    document.getElementById('welcomeScreen')?.addEventListener('touchstart', dismissWelcome, { passive: true });

    function dismissWelcome() {
      const welcome = document.getElementById('welcomeScreen');
      if (!welcome || welcome.classList.contains('fade-out')) return;
      welcome.classList.add('fade-out');
      setTimeout(() => welcome.remove(), 800);
    }

    /* ================================================================
       STATE
       ================================================================ */
    const API_BASE = window.location.origin;

    function getToken() { return localStorage.getItem('tabibak_jwt'); }
    function setToken(t) { localStorage.setItem('tabibak_jwt', t); }
    function clearToken() { localStorage.removeItem('tabibak_jwt'); }

    async function api(method, path, body) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      const token = getToken();
      if (token) opts.headers['Authorization'] = 'Bearer ' + token;
      if (body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(API_BASE + path, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    const STATE = {
      currentTab: 'landing',
      theme: 'light',
      currentUser: null,
      apiKeys: [],
      medicalKeys: [],
      sessions: [],
      triageSession: {
        symptom: '',
        chatLog: [],
        step: 0,
        totalSteps: 5,
        category: 'عام',
        redFlagFired: false,
        result: null,
      },
      breathing: {
        cycle: 0,
        totalCycles: 3,
        scores: [],
        timerHandle: null,
        phase: 'get-ready',
        phaseTime: 0,
        breathResult: null,
        muted: false,
      },
      food: {
        apiKey: '', // loaded from backend config dynamically to prevent git leaks
        selectedMood: '',
        currentData: null, // last fetched food recommendations (full JSON)
        currentMood: '',   // the mood/query that was used
        chatLog: [],       // [{ role: 'user'|'assistant', text: '...' }]
        savedSessionId: null, // id of the saved session in STATE.sessions
        lastModelUsed: '', // 'qwen/qwen3-32b' or 'llama-3.3-70b-versatile'
        preferredModel: '', // '' = auto (Qwen first), 'llama' = Llama first
      },
      medicalTest: {
        apiKey: '',
        apiKeys: [],
        lastResult: null,
        selectedImage: null, // base64 string
        selectedFileIsPdf: false,
        selectedFileName: '',
        extractedText: '',
        lastModelUsed: '',
      },
      bmi: null,
      meds: {
        list: [],
        taken: {},
        activeTab: 'today',
      },
      modalSessionIndex: -1,
      mentors: [],
      mentees: [],
      selectedMentee: null,
    };

    /* ================================================================
       STORAGE
       ================================================================ */
    function saveStorage() {
      try {
        STATE.meds.taken = STATE.meds.taken || {};
        localStorage.setItem('tabibak_meds_taken', JSON.stringify({
          date: new Date().toDateString(),
          taken: STATE.meds.taken,
        }));
      } catch (e) { }
    }

    async function loadProfile() {
      const token = getToken();
      if (!token) { STATE.currentUser = null; return; }
      try {
        STATE.currentUser = await api('GET', '/api/auth/profile');
        STATE.sessions = await api('GET', '/api/sessions');
        try { STATE.meds.list = await api('GET', '/api/medications'); } catch (e) { STATE.meds.list = []; }
        try { await loadMentorData(); } catch (e) {}
      } catch (e) {
        clearToken();
        STATE.currentUser = null;
      }
    }

    function loadLocalMedsTaken() {
      try {
        const mt = localStorage.getItem('tabibak_meds_taken');
        if (mt) {
          const parsed = JSON.parse(mt);
          if (parsed.date === new Date().toDateString()) {
            STATE.meds.taken = parsed.taken || {};
          }
        }
      } catch (e) { }
    }

    /* ================================================================
       GOLE SIGN-IN
       ================================================================ */
    let googleClientId = '';
    let googleInitAttempted = false;

    async function loadGoogleClientId() {
      try {
        const res = await fetch('/api/config/google-client-id');
        const data = await res.json();
        googleClientId = data.clientId;
        if (googleClientId) tryRenderGoogleButton();
      } catch (e) { /* Google auth not configured */ }
    }

    function tryRenderGoogleButton() {
      if (!googleClientId || googleInitAttempted) return;
      if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(tryRenderGoogleButton, 300);
        return;
      }
      googleInitAttempted = true;
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
      });
      google.accounts.id.renderButton(
        document.getElementById('googleSignInDiv'),
        { theme: 'outline', size: 'large', type: 'standard', shape: 'pill', text: 'signin_with', width: 280 }
      );
    }

    async function handleGoogleCredentialResponse(response) {
      try {
        const data = await api('POST', '/api/auth/google', { credential: response.credential });
        if (data.token) {
          setToken(data.token);
          STATE.currentUser = data;
        STATE.sessions = await api('GET', '/api/sessions');
        try { STATE.meds.list = await api('GET', '/api/medications'); } catch (e) { STATE.meds.list = []; }
        try { await loadMentorData(); } catch (e) {}
          if (Notification.permission === 'granted') { startReminderScheduler(); requestFcmToken(); }
          refreshProfileScreen();
          showTab('profile');
        } else if (data.needsVerification) {
          STATE.pendingGoogleUser = data;
          document.getElementById('verificationDesc').textContent = `لقد أرسلنا رمز تحقق إلى ${data.email}. يرجى إدخاله أدناه.`;
          document.getElementById('verificationCodeInput').value = '';
          document.getElementById('verificationError').style.display = 'none';
          document.getElementById('verificationModal').classList.add('open');
        }
      } catch (err) {
        alert(err.message || 'فشل تسجيل الدخول عبر Google');
      }
    }

    /* ================================================================
       VERIFICATION CODE
       ================================================================ */
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

    /* ================================================================
       NAVIGATION
       ================================================================ */
    function showTab(tabId) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

      const screenMap = {
        landing: 'screen-landing',
        chat: 'screen-chat',
        breathing: 'screen-breathing',
        results: 'screen-results',
        meds: 'screen-meds',
        food: 'screen-food',
        'medical-test': 'screen-medical-test',
        bmi: 'screen-bmi',
        pharmacist: 'screen-pharmacist',
        profile: 'screen-profile',
        history: 'screen-history',
        mentor: 'screen-mentor',
      };

      const el = document.getElementById(screenMap[tabId]);
      if (el) el.classList.add('active');

      document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId ||
          (btn.dataset.tab === 'landing' && ['chat', 'breathing', 'results'].includes(tabId));
        btn.classList.toggle('active', isActive);
      });

      STATE.currentTab = tabId;

      if (tabId === 'history') refreshHistoryScreen();
      if (tabId === 'profile') refreshProfileScreen();
      if (tabId === 'pharmacist') refreshPharmacistScreen();
      if (tabId === 'food') updateFoodContextBar();
      if (tabId === 'meds') {
        renderMedsScreen();
        refreshNotifSettingsUi();
      }
      if (tabId === 'mentor') renderMentorScreen();
    }

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === 'landing' && STATE.triageSession.chatLog.length > 0 && !STATE.triageSession.result) {
          showTab('chat');
        } else {
          showTab(btn.dataset.tab);
        }
      });
    });
    document.getElementById('accountNavBtn').addEventListener('click', () => {
      showTab('profile');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    });
    document.querySelector('.header-brand').addEventListener('click', () => {
      if (STATE.triageSession.chatLog.length > 0 && !STATE.triageSession.result) {
        showTab('chat');
      } else {
        showTab('landing');
      }
    });
    /* ================================================================
       MENTOR MODULE
       ================================================================ */
    async function loadMentorData() {
      if (!STATE.currentUser) return;
      try {
        const [mentors, mentees] = await Promise.allSettled([
          api('GET', '/api/mentors'),
          api('GET', '/api/mentors/mentees'),
        ]);
        STATE.mentors = mentors.status === 'fulfilled' && Array.isArray(mentors.value) ? mentors.value : [];
        STATE.mentees = mentees.status === 'fulfilled' && Array.isArray(mentees.value) ? mentees.value : [];
      } catch (e) {
        STATE.mentors = [];
        STATE.mentees = [];
      }
    }

    function renderMentorScreen() {
      const errEl = document.getElementById('mentorError');
      errEl.style.display = 'none';
      document.getElementById('mentorDetailView').style.display = 'none';
      document.getElementById('mentorMentorsSection').style.display = '';
      document.getElementById('mentorMenteesSection').style.display = '';

      // Render mentors list
      const list = document.getElementById('mentorMentorsList');
      if (STATE.mentors.length === 0) {
        list.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">لم تقم بإضافة أي مرشد بعد.</p>';
      } else {
        list.innerHTML = STATE.mentors.map(m => `
          <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:0.6rem 0.8rem;">
            <i class="ti ti-user-check" style="color:var(--primary);font-size:1.1rem;"></i>
            <div style="flex:1;"><strong>${m.name}</strong> <span style="color:var(--text-2);font-size:0.8rem;">@${m.mentorUsername}</span></div>
            <button class="mentor-remove-btn" data-user="${m.mentorUsername}" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;" title="إزالة"><i class="ti ti-trash"></i></button>
          </div>
        `).join('');
        list.querySelectorAll('.mentor-remove-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!confirm('إزالة هذا المرشد؟')) return;
            try {
              await api('DELETE', `/api/mentors/${btn.dataset.user}`);
              await loadMentorData();
              renderMentorScreen();
            } catch (e) { showMentorError(e.message); }
          });
        });
      }

      // Render mentees list
      const menteesList = document.getElementById('mentorMenteesList');
      if (STATE.mentees.length === 0) {
        menteesList.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">لا يوجد مشرف عليهم حالياً.</p>';
      } else {
        menteesList.innerHTML = STATE.mentees.map(m => `
          <div class="mentee-card" data-user="${m.username}" style="display:flex;align-items:center;gap:0.5rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:0.6rem 0.8rem;cursor:pointer;transition:all var(--speed);">
            <i class="ti ti-user" style="color:var(--primary);font-size:1.2rem;"></i>
            <div style="flex:1;"><strong>${m.name}</strong> <span style="color:var(--text-2);font-size:0.8rem;">@${m.username}</span></div>
            <i class="ti ti-chevron-left" style="color:var(--text-2);"></i>
          </div>
        `).join('');
        menteesList.querySelectorAll('.mentee-card').forEach(card => {
          card.addEventListener('click', () => openMenteeDetail(card.dataset.user));
        });
      }
    }

    function showMentorError(msg) {
      const el = document.getElementById('mentorError');
      el.textContent = msg;
      el.style.display = '';
    }

    let currentMenteeUser = '';

    async function openMenteeDetail(username) {
      currentMenteeUser = username;
      STATE.selectedMentee = username;
      document.getElementById('mentorMentorsSection').style.display = 'none';
      document.getElementById('mentorMenteesSection').style.display = 'none';
      document.getElementById('mentorDetailView').style.display = '';

      const content = document.getElementById('mentorDetailContent');
      content.innerHTML = '<p style="color:var(--text-2);">جارٍ تحميل البيانات...</p>';

      const mentee = STATE.mentees.find(m => m.username === username);
      const header = `
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
          <i class="ti ti-user" style="font-size:1.5rem;color:var(--primary);"></i>
          <div>
            <h3 style="margin:0;">${mentee?.name || username}</h3>
            <span style="color:var(--text-2);font-size:0.8rem;">@${username} ${mentee?.age ? '· ' + mentee.age + ' سنة' : ''} ${mentee?.gender ? '· ' + mentee.gender : ''}</span>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button class="btn btn-secondary mentee-tab-btn active" data-tab="sessions" style="flex:1;font-size:0.8rem;">الجلسات</button>
          <button class="btn btn-secondary mentee-tab-btn" data-tab="meds" style="flex:1;font-size:0.8rem;">الأدوية</button>
          <button class="btn btn-secondary mentee-tab-btn" data-tab="nutrition" style="flex:1;font-size:0.8rem;">التغذية</button>
          <button class="btn btn-secondary mentee-tab-btn" data-tab="chat" style="flex:1;font-size:0.8rem;">محادثة</button>
        </div>
        <div id="menteeTabContent"></div>
      `;
      content.innerHTML = header;

      content.querySelectorAll('.mentee-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          content.querySelectorAll('.mentee-tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          loadMenteeTab(btn.dataset.tab, username);
        });
      });

      loadMenteeTab('sessions', username);
    }

    async function loadMenteeTab(tab, username) {
      const tabContent = document.getElementById('menteeTabContent');
      tabContent.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">جارٍ التحميل...</p>';
      try {
        if (tab === 'sessions') await renderMenteeSessions(username, tabContent);
        else if (tab === 'meds') await renderMenteeMeds(username, tabContent);
        else if (tab === 'nutrition') await renderMenteeNutrition(username, tabContent);
        else if (tab === 'chat') await renderMenteeChat(username, tabContent);
      } catch (e) {
        tabContent.innerHTML = `<p style="color:var(--red);font-size:0.85rem;">خطأ: ${e.message}</p>`;
      }
    }

    async function renderMenteeSessions(username, container) {
      const sessions = await api('GET', `/api/mentors/mentee/${username}/sessions`);
      if (!sessions || sessions.length === 0) {
        container.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">لا توجد جلسات لهذا المستخدم.</p>';
        return;
      }
      container.innerHTML = sessions.map(s => {
        const typeIcon = s.type === 'medical-test' ? '🔬' : s.type === 'nutrition' ? '🍽️' : '🩺';
        const badge = s.badge || s.details || s.type;
        return `
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;">
              <span>${typeIcon}</span>
              <strong>${badge}</strong>
              <span style="color:var(--text-2);font-size:0.75rem;margin-right:auto;">${new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
            </div>
            ${s.analysis ? `<p style="font-size:0.85rem;color:var(--text-2);margin:0.3rem 0;">${s.analysis}</p>` : ''}
            ${s.notes?.length > 0 ? s.notes.map(n => `<div style="font-size:0.8rem;background:var(--primary-glow);padding:0.3rem 0.5rem;border-radius:8px;margin-top:0.3rem;"><strong>ملاحظتك:</strong> ${n.note}</div>`).join('') : ''}
            <button class="mentor-add-note-btn" data-session="${s.id}" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:0.8rem;margin-top:0.3rem;"><i class="ti ti-plus"></i> إضافة ملاحظة</button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.mentor-add-note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sessionId = btn.dataset.session;
          const note = prompt('أدخل ملاحظتك الطبية:');
          if (note && note.trim()) {
            addMenteeNote(username, sessionId, note.trim());
          }
        });
      });
    }

    async function addMenteeNote(username, sessionId, note) {
      try {
        await api('POST', `/api/mentors/mentee/${username}/note`, { sessionId, note });
        loadMenteeTab('sessions', username);
      } catch (e) {
        showMentorError(e.message);
      }
    }

    async function renderMenteeMeds(username, container) {
      const [meds, log] = await Promise.all([
        api('GET', `/api/mentors/mentee/${username}/meds`),
        api('GET', `/api/mentors/mentee/${username}/meds/log/${new Date().toISOString().slice(0, 10)}`),
      ]);
      const takenMap = {};
      if (log) log.forEach(l => { takenMap[`${l.medicationId}_${l.doseIdx}`] = true; });

      if (!meds || meds.length === 0) {
        container.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">لا توجد أدوية مسجلة.</p><button class="btn btn-primary" id="mentorAddMedBtn" style="font-size:0.8rem;margin-top:0.5rem;">+ إضافة دواء</button>';
        container.querySelector('#mentorAddMedBtn')?.addEventListener('click', () => showMentorAddMedForm(username, container));
        return;
      }
      container.innerHTML = meds.map(m => `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <strong>${m.name}</strong>
            <span style="color:var(--text-2);font-size:0.8rem;">${m.dose} - ${m.form}</span>
            <button class="mentor-del-med" data-med="${m.id}" style="background:none;border:none;color:var(--red);cursor:pointer;margin-right:auto;" title="حذف"><i class="ti ti-trash"></i></button>
          </div>
          ${(m.doses || []).map((d, idx) => {
            const key = `${m.id}_${idx}`;
            const done = !!takenMap[key];
            return `<div style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;padding:0.2rem 0;">
              <span>${d.time}</span>
              <button class="mentor-take-btn" data-med="${m.id}" data-idx="${idx}" style="background:none;border:none;cursor:pointer;color:${done ? 'var(--green)' : 'var(--text-2)'};">${done ? '✅' : '⬜'} ${done ? 'تم' : 'تأكيد'}</button>
            </div>`;
          }).join('')}
        </div>
      `).join('') + `<button class="btn btn-primary" id="mentorAddMedBtn" style="font-size:0.8rem;margin-top:0.5rem;">+ إضافة دواء</button>`;

      container.querySelectorAll('.mentor-take-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await api('POST', `/api/mentors/mentee/${username}/med-log`, {
              medicationId: btn.dataset.med, doseIdx: parseInt(btn.dataset.idx), date: new Date().toISOString().slice(0, 10),
            });
            loadMenteeTab('meds', username);
          } catch (e) { showMentorError(e.message); }
        });
      });
      container.querySelectorAll('.mentor-del-med').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('حذف هذا الدواء؟')) return;
          try {
            await api('DELETE', `/api/mentors/mentee/${username}/meds/${btn.dataset.med}`);
            loadMenteeTab('meds', username);
          } catch (e) { showMentorError(e.message); }
        });
      });
      container.querySelector('#mentorAddMedBtn')?.addEventListener('click', () => showMentorAddMedForm(username, container));
    }

    function showMentorAddMedForm(username, container) {
      const id = 'med_' + Date.now();
      container.innerHTML = `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:1rem;">
          <h4 style="margin-bottom:0.75rem;">إضافة دواء جديد</h4>
          <input id="mMedName" placeholder="اسم الدواء" style="display:block;width:100%;padding:0.5rem;margin-bottom:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:inherit;">
          <input id="mMedDose" placeholder="الجرعة (مثال: 500mg)" style="display:block;width:100%;padding:0.5rem;margin-bottom:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:inherit;">
          <input id="mMedForm" placeholder="الشكل (مثال: Pill)" value="Pill" style="display:block;width:100%;padding:0.5rem;margin-bottom:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:inherit;">
          <input id="mMedTime" type="time" value="08:00" style="display:block;width:100%;padding:0.5rem;margin-bottom:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--input-bg);color:inherit;">
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-primary" id="mMedSaveBtn" style="flex:1;">حفظ</button>
            <button class="btn btn-secondary" id="mMedCancelBtn" style="flex:1;">إلغاء</button>
          </div>
        </div>
      `;
      document.getElementById('mMedSaveBtn').addEventListener('click', async () => {
        const name = document.getElementById('mMedName').value.trim();
        const dose = document.getElementById('mMedDose').value.trim();
        const form = document.getElementById('mMedForm').value.trim() || 'Pill';
        const time = document.getElementById('mMedTime').value || '08:00';
        if (!name || !dose) { alert('اسم الدواء والجرعة مطلوبان'); return; }
        try {
          await api('POST', `/api/mentors/mentee/${username}/meds`, { id, name, dose, form, doses: [{ time }] });
          loadMenteeTab('meds', username);
        } catch (e) { showMentorError(e.message); }
      });
      document.getElementById('mMedCancelBtn').addEventListener('click', () => loadMenteeTab('meds', username));
    }

    async function renderMenteeNutrition(username, container) {
      const session = await api('GET', `/api/mentors/mentee/${username}/nutrition`);
      if (!session || !session.result) {
        container.innerHTML = '<p style="color:var(--text-2);font-size:0.85rem;">لا توجد خطة غذائية بعد.</p>';
        return;
      }
      const r = session.result;
      container.innerHTML = `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
            <span class="food-condition-badge">${r.badge || ''}</span>
          </div>
          ${r.analysis ? `<p style="font-size:0.85rem;color:var(--text-2);margin-bottom:0.5rem;">${r.analysis}</p>` : ''}
          <div class="food-cards">${(r.cards || []).map(c => `
            <div class="food-card">
              <div class="food-card-icon">${c.icon || ''}</div>
              <div class="food-card-title">${c.title || ''}</div>
              <ul class="food-card-items">${(c.items || []).map(i => `<li>${i.name}${i.reason ? `<br><small style="color:var(--text-muted);">${i.reason}</small>` : ''}</li>`).join('')}</ul>
            </div>
          `).join('')}</div>
          <p style="font-size:0.8rem;color:var(--text-2);margin-top:0.5rem;">آخر تحديث: ${new Date(session.createdAt).toLocaleDateString('ar-EG')}</p>
        </div>
      `;
    }

    async function renderMenteeChat(username, container) {
      const msgs = await api('GET', `/api/mentors/mentee/${username}/chat`);
      container.innerHTML = `
        <div id="menteeChatLog" style="display:flex;flex-direction:column;gap:0.5rem;max-height:300px;overflow-y:auto;margin-bottom:0.5rem;padding:0.5rem;background:var(--bg-surface);border-radius:12px;border:1px solid var(--border);">
          ${(msgs || []).map(m => `
            <div style="align-self:${m.role === 'mentor' ? 'flex-end' : 'flex-start'};background:${m.role === 'mentor' ? 'var(--primary)' : 'var(--bubble-bot)'};color:${m.role === 'mentor' ? 'white' : 'inherit'};padding:0.4rem 0.8rem;border-radius:12px;max-width:85%;font-size:0.85rem;word-break:break-word;">
              ${m.message}
              <div style="font-size:0.65rem;opacity:0.7;margin-top:0.2rem;">${new Date(m.createdAt).toLocaleTimeString('ar-EG')}</div>
            </div>
          `).join('') || '<p style="color:var(--text-2);font-size:0.8rem;text-align:center;">لا توجد رسائل بعد.</p>'}
        </div>
        <div style="display:flex;gap:0.5rem;">
          <input type="text" id="menteeChatInput" placeholder="اكتب رسالة..."
            style="flex:1;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-surface);color:inherit;font-size:0.9rem;" />
          <button class="btn btn-primary" id="menteeChatSendBtn">إرسال</button>
        </div>
      `;
      document.getElementById('menteeChatSendBtn').addEventListener('click', async () => {
        const input = document.getElementById('menteeChatInput');
        const msg = input.value.trim();
        if (!msg) return;
        input.value = '';
        try {
          await api('POST', `/api/mentors/mentee/${username}/chat`, { message: msg });
          renderMenteeChat(username, container);
        } catch (e) { showMentorError(e.message); }
      });
      document.getElementById('menteeChatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('menteeChatSendBtn').click();
      });
    }

    document.getElementById('mentorAddBtn').addEventListener('click', async () => {
      const input = document.getElementById('mentorAddInput');
      const username = input.value.trim();
      if (!username) { showMentorError('يرجى إدخال اسم المستخدم'); return; }
      input.value = '';
      try {
        await api('POST', '/api/mentors', { mentorUsername: username });
        await loadMentorData();
        renderMentorScreen();
      } catch (e) { showMentorError(e.message); }
    });

    document.getElementById('mentorBackBtn').addEventListener('click', () => {
      STATE.selectedMentee = null;
      renderMentorScreen();
    });

    document.getElementById('mentorAddInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('mentorAddBtn').click();
    });

    /* ================================================================
       THEME TOGGLE
       ================================================================ */
    document.getElementById('themeBtn').addEventListener('click', () => {
      STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
      document.body.classList.toggle('dark', STATE.theme === 'dark');
      document.getElementById('themeBtn').innerHTML = STATE.theme === 'dark'
        ? '<i class="ti ti-moon theme-icon moon"></i>'
        : '<i class="ti ti-sun theme-icon sun"></i>';
    });

    /* ================================================================
       BREATHING AUDIO MODULE
       ================================================================ */
    let audioCtx = null;
    let activeUtterance = null; // Keeps a reference to prevent garbage collection in Chrome

    function getAudioCtx() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioCtx;
    }

    // Warm up the AudioContext on user gesture
    function warmUpAudio() {
      try {
        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      } catch (e) { }
    }

    function playChime(freq = 528, duration = 1.2) {
      if (STATE.breathing.muted) return;
      try {
        const ctx = getAudioCtx();
        // Fallback resume just in case, though it should be warmed up
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch (e) { }
    }

    function speakPhase(text) {
      if (STATE.breathing.muted) return;
      if ('speechSynthesis' in window) {
        try {
          // Chrome speech synthesis freeze fix
          speechSynthesis.cancel();
          if (speechSynthesis.paused) {
            speechSynthesis.resume();
          }

          const utt = new SpeechSynthesisUtterance(text);
          activeUtterance = utt; // prevent GC bug

          utt.rate = 0.85;
          utt.pitch = 1.0;
          utt.volume = 1.0;

          const voices = speechSynthesis.getVoices();
          const preferred = voices.find(v => v.lang.startsWith('ar')) ||
            voices.find(v => v.lang.startsWith('en'));
          if (preferred) utt.voice = preferred;

          utt.onend = () => { activeUtterance = null; };
          utt.onerror = () => { activeUtterance = null; };

          speechSynthesis.speak(utt);
        } catch (e) { }
      }
    }

    document.getElementById('breathMuteBtn').addEventListener('click', () => {
      STATE.breathing.muted = !STATE.breathing.muted;
      document.getElementById('breathMuteBtn').innerHTML = STATE.breathing.muted
        ? '<i class="ti ti-volume-off"></i>'
        : '<i class="ti ti-volume"></i>';
      if (STATE.breathing.muted && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
    });

    /* ================================================================
       MEDICATION REMINDER MODULE
       ================================================================ */
    const DEFAULT_MEDS = [
      { id: 1, name: 'ميتفورمين', dose: '500 ملجم', form: 'قرص', doseCount: 2, doses: [{ time: '08:00' }, { time: '20:00' }], food: "نعم — يُؤخذ مع الوجبة", urgent: false, note: 'مع الإفطار والعشاء', icon: 'ti-pill', color: '#0e2a2a' },
      { id: 2, name: 'ليزينوبريل', dose: '10 ملجم', form: 'قرص', doseCount: 1, doses: [{ time: '09:00' }], food: "لا يهم", urgent: true, note: 'ضغط الدم — لا يُفوَّت', icon: 'ti-heartbeat', color: '#1a1a3a' },
      { id: 3, name: 'فيتامين د', dose: '1000 وحدة', form: 'كبسولة', doseCount: 1, doses: [{ time: '12:00' }], food: "نعم — يُؤخذ مع الوجبة", urgent: false, note: 'يُؤخذ مع وجبة', icon: 'ti-sun', color: '#2a1a00' },
      { id: 4, name: 'أوميغا 3', dose: '1 جرام', form: 'كبسولة', doseCount: 1, doses: [{ time: '21:00' }], food: "لا يهم", urgent: false, note: 'جرعة المساء', icon: 'ti-fish', color: '#0e1a2a' },
    ];

    const FORM_ICONS = {
      'قرص': 'ti-pill',
      'كبسولة': 'ti-pill',
      'شراب': 'ti-droplet',
      'حقنة': 'ti-vaccine',
      'قطرات': 'ti-droplet-half-2',
      'كريم': 'ti-bottle',
    };

    function getIconForForm(form) {
      return FORM_ICONS[form] || 'ti-pill';
    }
    const PILL_COLORS = ['#0e2a2a', '#1a1a3a', '#2a1a00', '#0e1a2a', '#1a2a1a', '#2a0e0e', '#1a0e2a', '#0e1a2a'];

    function getTimeLabel(time24) {
      const [h, m] = time24.split(':').map(Number);
      const ampm = h >= 12 ? 'م' : 'ص';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    function roundTo5Min(timeStr) {
      return timeStr;
    }

    function renderMedsScreen() {
      if (STATE.meds.list.length === 0 && !STATE.currentUser && !STATE.meds.defaultsDismissed) {
        STATE.meds.list = JSON.parse(JSON.stringify(DEFAULT_MEDS));
        STATE.meds.taken['1_0'] = true;
      }

      const list = STATE.meds.list;
      const taken = STATE.meds.taken;

      const totalDoses = list.reduce((sum, m) => sum + (m.doses ? m.doses.length : 1), 0);
      const takenCount = Object.keys(taken).filter(k => taken[k]).length;
      const pct = totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 0;

      document.getElementById('medsProgressCount').textContent = `تم أخذ ${takenCount}/${totalDoses} من الجرعات`;
      document.getElementById('medsProgressFill').style.width = `${pct}%`;

      const urgentNotTaken = list.find(m => {
        if (!m.urgent) return false;
        const doses = m.doses || [{ time: m.time || '08:00' }];
        return doses.some((_, i) => !taken[`${m.id}_${i}`]);
      });

      const tipCard = document.getElementById('medsTipCard');
      if (urgentNotTaken) {
        document.getElementById('medsTipText').innerHTML =
          `<strong>${urgentNotTaken.name}</strong> مُصنَّف كدواء حيوي — لم تُؤخذ إحدى الجرعات اليوم. ` +
          `<a id="medsTipLearnMore">اعرف المزيد ↗</a>`;
        tipCard.style.display = '';
        const learnMore = document.getElementById('medsTipLearnMore');
        if (learnMore) learnMore.onclick = () => {
          alert(`استشر طبيبك قبل تفويت أي جرعة من ${urgentNotTaken.name}.`);
        };
      } else {
        tipCard.style.display = 'none';
      }

      const container = document.getElementById('medsListContainer');
      const activeTab = STATE.meds.activeTab;

      if (activeTab === 'history') {
        container.innerHTML = `<div class="meds-empty">
          <i class="ti ti-history"></i>
          <h3>السجل قريباً</h3>
          <p>سيظهر هنا سجل الالتزام الأسبوعي والشهري.</p>
        </div>`;
        return;
      }

      if (activeTab === 'upcoming') {
        container.innerHTML = `<div class="meds-empty">
          <i class="ti ti-calendar"></i>
          <h3>لا توجد جرعات قادمة</h3>
          <p>ستظهر هنا الجرعات المستقبلية وتذكيرات الإعادة.</p>
        </div>`;
        return;
      }

      const allDoses = [];
      list.forEach(med => {
        const doses = med.doses || [{ time: med.time || '08:00' }];
        doses.forEach((dose, doseIdx) => {
          allDoses.push({ med, dose, doseIdx });
        });
      });

      const morning = allDoses.filter(d => parseInt(d.dose.time.split(':')[0]) < 12);
      const afternoon = allDoses.filter(d => {
        const h = parseInt(d.dose.time.split(':')[0]);
        return h >= 12 && h < 17;
      });
      const evening = allDoses.filter(d => parseInt(d.dose.time.split(':')[0]) >= 17);

      let html = '';
      if (morning.length)
        html += renderDoseSection('<span style="font-size:1.2rem"><i class="ti ti-sunrise"></i> جرعات الصباح', morning, taken);
      if (afternoon.length)
        html += renderDoseSection('<span style="font-size:1.2rem"><i class="ti ti-sun"></i> جرعات الظهر', afternoon, taken);
      if (evening.length)
        html += renderDoseSection('<span style="font-size:1.2rem"><i class="ti ti-moon"></i> جرعات المساء', evening, taken);

      if (!allDoses.length) {
        html = `<div class="meds-empty">
          <i class="ti ti-pill"></i>
          <h3>لم تُضَف أدوية بعد</h3>
          <p>انقر على "إضافة دواء" لجدولة دوائك الأول.</p>
        </div>`;
      }

      container.innerHTML = html;

      container.querySelectorAll('.med-check-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const key = btn.dataset.key;
          const [medId, doseIdx] = key.split('_');
          const date = new Date().toISOString().slice(0, 10);
          if (STATE.meds.taken[key]) {
            delete STATE.meds.taken[key];
          } else {
            STATE.meds.taken[key] = true;
            if (STATE.currentUser) {
              try { await api('POST', '/api/medications/log', { medicationId: medId, doseIdx: parseInt(doseIdx), date }); } catch (e) { }
            }
          }
          saveStorage();
          renderMedsScreen();
        });
      });

      container.querySelectorAll('.med-delete-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const id = btn.dataset.id;
          if (confirm('Remove this medication from your list?')) {
            if (STATE.currentUser) {
              try { await api('DELETE', '/api/medications/' + id); } catch (e) { alert('فشل حذف الدواء. يرجى المحاولة مرة أخرى.'); return; }
            } else {
              STATE.meds.defaultsDismissed = true;
            }
            STATE.meds.list = STATE.meds.list.filter(m => String(m.id) !== id);
            Object.keys(STATE.meds.taken).forEach(k => {
              if (k.startsWith(id + '_')) delete STATE.meds.taken[k];
            });
            saveStorage();
            renderMedsScreen();
          }
        });
      });
    }

    function renderDoseSection(label, doses, taken) {
      return `<div class="meds-section-label">${label}</div>
      ${doses.map(({ med, dose, doseIdx }) => renderDoseCard(med, dose, doseIdx, taken)).join('')}`;
    }

    function renderDoseCard(med, dose, doseIdx, taken) {
      const key = `${med.id}_${doseIdx}`;
      const done = !!taken[key];
      const totalDoses = med.doses ? med.doses.length : 1;
      const doseLabel = totalDoses > 1 ? ` · الجرعة ${doseIdx + 1}/${totalDoses}` : '';

      return `
      <div class="med-card ${done ? 'taken' : ''}">
        <div class="med-pill-icon" style="background:${med.color || '#0e2a2a'};"><i class="ti ${med.icon || 'ti-pill'}" aria-hidden="true"></i></div>
        <div class="med-info">
          <div class="med-name">
            ${med.name}
            <span class="med-dose">${med.dose} · ${med.form}${doseLabel}</span>
            ${med.urgent ? '<span class="med-skip-badge">لا يُفوَّت</span>' : ''}
          </div>
          <div class="med-sub">${med.food}</div>
          ${med.note ? `<div class="med-note"><i class="ti ti-info-circle" style="font-size:13px;" aria-hidden="true"></i>${med.note}</div>` : ''}
          <div class="med-time">
            <i class="ti ti-clock" style="font-size:13px;" aria-hidden="true"></i>
            ${getTimeLabel(dose.time)}
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-shrink:0;">
          ${doseIdx === 0 ? `<button class="icon-btn med-delete-btn" data-id="${med.id}" title="حذف الدواء" style="width:32px;height:32px;border-radius:8px;">
            <svg style="width:14px;height:14px;"><use href="#icon-trash"/></svg>
          </button>` : '<div style="width:32px;"></div>'}
          <button class="med-check-btn ${done ? 'done' : ''}" data-key="${key}" aria-label="${done ? 'تمييز كغير مأخوذ' : 'تمييز كمأخوذ'}">
            <i class="ti ti-check" aria-hidden="true"></i>
          </button>
        </div>
      </div>`;
    }

    document.querySelectorAll('.meds-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.meds-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        STATE.meds.activeTab = tab.dataset.medtab;
        renderMedsScreen();
      });
    });

    /* ================================================================
       ADD MEDICATION MODAL
       ================================================================ */
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

    /* ================================================================
       FCM PUSH NOTIFICATIONS — Firebase Cloud Messaging
       ================================================================ */

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

    /* ================================================================
       TRIAGE CHAT ENGINE
       ================================================================ */
    const RED_FLAG_TERMS = [
      'ألم في الصدر', 'ضغط على الصدر', 'نوبة قلبية', 'لا أستطيع التنفس',
      'صعوبة في التنفس', 'ألم شديد في الصدر', 'تنميل في الذراع',
      'جلطة', 'تدلي الوجه', 'مشكلة في الكلام', 'صداع شديد',
      'فقدان الوعي', 'إغماء', 'نزيف حاد', 'سعال بدم', 'تقيؤ دم',
      'انتحار', 'إيذاء النفس', 'جرعة زائدة',
      'chest pain', 'can\'t breathe', 'difficulty breathing', 'stroke',
      'unconscious', 'severe bleeding', 'suicidal', 'overdose',
    ];

    const TRIAGE_QUESTIONS = [
      { q: 'منذ متى بدأت هذه الأعراض؟', category: 'المدة' },
      { q: 'على مقياس من 1 إلى 10، ما شدة الانزعاج الذي تشعر به؟', category: 'الشدة' },
      { q: 'هل لديك أي أمراض مزمنة أو أدوية تأخذها حالياً؟', category: 'التاريخ المرضي' },
      { q: 'هل سبق أن عانيت من هذه الأعراض؟ وماذا حدث؟', category: 'السوابق' },
      { q: 'هل لديك حساسية من أي شيء، خاصة الأدوية؟', category: 'الحساسية' },
    ];

    function appendMessage(role, text, fileDataUrl) {
      const log = document.getElementById('chatLog');
      const div = document.createElement('div');
      div.className = `msg msg-${role}`;
      if (fileDataUrl) {
        if (text) {
          const p = document.createElement('p');
          p.textContent = text;
          div.appendChild(p);
        }
        if (fileDataUrl.startsWith('data:application/pdf')) {
          // Extract filename from text marker like "[PDF: name.pdf]"
          const nameMatch = text && text.match(/\[PDF: (.+?)\]/);
          const fileName = nameMatch ? nameMatch[1] : 'file.pdf';
          const a = document.createElement('a');
          a.href = fileDataUrl;
          a.download = fileName;
          a.className = 'chat-file-link';
          a.innerHTML = `<i class="ti ti-file-text" style="font-size:1.5rem;"></i> <span>${fileName}</span>`;
          a.target = '_blank';
          div.appendChild(a);
        } else {
          const img = document.createElement('img');
          img.className = 'chat-img';
          img.src = fileDataUrl;
          div.appendChild(img);
        }
      } else {
        div.textContent = text;
      }
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
      STATE.triageSession.chatLog.push({ role, text, image: fileDataUrl || null });
    }

    function showSuggestions(chips) {
      const log = document.getElementById('chatLog');
      const old = log.querySelector('.suggestions');
      if (old) old.remove();

      if (!chips || chips.length === 0) return;

      const wrap = document.createElement('div');
      wrap.className = 'suggestions';
      chips.forEach(label => {
        const btn = document.createElement('button');
        btn.className = 'suggestion-chip';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          wrap.remove();
          document.getElementById('chatInput').value = label;
          handleUserChatInput();
        });
        wrap.appendChild(btn);
      });
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
    }

    function showTypingThenAppend(text, delay = 900) {
      const log = document.getElementById('chatLog');
      const dots = document.createElement('div');
      dots.className = 'typing-dots';
      dots.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
      log.appendChild(dots);
      log.scrollTop = log.scrollHeight;
      return new Promise(resolve => {
        setTimeout(() => { dots.remove(); appendMessage('bot', text); resolve(); }, delay);
      });
    }

    function updateProgress(step, total) {
      document.getElementById('progressLabel').textContent = `السؤال ${step}/${total}`;
      document.getElementById('progressFill').style.width = `${(step / total) * 100}%`;
    }

    function checkRedFlags(text) {
      const lower = text.toLowerCase();
      const hit = RED_FLAG_TERMS.some(term => lower.includes(term.toLowerCase()));
      if (hit && !STATE.triageSession.redFlagFired) {
        STATE.triageSession.redFlagFired = true;
        document.getElementById('redFlagBanner').classList.add('visible');
      }
    }

    let triageKeyIndex = 0;
    const TRIAGE_MAX_QUESTIONS = 13;

    async function askTriageQwen() {
      const step = STATE.triageSession.step;
      if (step >= TRIAGE_MAX_QUESTIONS) { finishTriage(); return; }

      const apiKeys = STATE.apiKeys && STATE.apiKeys.length > 0 ? STATE.apiKeys
        : (STATE.medicalKeys && STATE.medicalKeys.length > 0 ? STATE.medicalKeys : []);

      if (apiKeys.length === 0) {
        askFixedQuestion();
        return;
      }

      document.getElementById('categoryBadge').textContent = 'الذكاء الاصطناعي';
      updateProgress(step, TRIAGE_MAX_QUESTIONS);

      const messages = [
        {
          role: 'system',
          content: `أنت طبيب تشخيص. دورك هو جمع معلومات عن أعراض المريض.
المريض أبلغ عن عرضه: "${STATE.triageSession.symptom}".

القواعد:
- اسأل سؤالاً تشخيصياً واحداً فقط في كل مرة
- اسأل عن أي شيء تحتاجه لتشخيص الحالة — أنت حر تماماً
- لديك ${TRIAGE_MAX_QUESTIONS} أسئلة كحد أقصى. السؤال الحالي رقم ${step + 1}
- أخرج سؤالاً واحداً فقط — لا تفكير، لا شرح، لا تحليل، لا markdown
- في كل سؤال، أضف اقتراحات للإجابة بهذا التنسيق: ---اقتراحات: خيار1, خيار2, خيار3
- مثال: هل الألم مستمر أم متقطع؟ ---اقتراحات: مستمر, متقطع, يأتي ويروح
- هذا إلزامي في كل سؤال — دائماً أضف اقتراحات

إذا طلب المريض معرفة التشخيص أو النتيجة الآن بأي عبارة → أجب فقط: {"done": true}`
        }
      ];

      for (const m of STATE.triageSession.chatLog) {
        if (m.role === 'user' || m.role === 'bot') {
          messages.push({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text || '' });
        }
      }

      let lastError;
      for (let i = 0; i < apiKeys.length; i++) {
        const keyIdx = (triageKeyIndex + i) % apiKeys.length;
        const apiKey = apiKeys[keyIdx];
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: 'qwen/qwen3-32b',
              temperature: 0.3,
              max_tokens: 500,
              messages,
            }),
          });
          if (res.status === 429) {
            triageKeyIndex = (keyIdx + 1) % apiKeys.length;
            lastError = new Error('rate_limited');
            continue;
          }
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (msg.includes('decommissioned') || msg.includes('deprecated')) {
              lastError = new Error(msg); continue;
            }
            throw new Error(msg || 'فشل الاتصال');
          }
          const data = await res.json();
          const responseText = data.choices?.[0]?.message?.content?.trim();
          if (!responseText) throw new Error('لم يرد بنص');

          triageKeyIndex = (keyIdx + 1) % apiKeys.length;

          // Strip  tags (Qwen thinking/reasoning)
          let cleanText = responseText.replace(/[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          // If after stripping thinking nothing remains, use the original
          cleanText = cleanText || responseText;

          // Check if Qwen wants to conclude early
          try {
            const parsed = JSON.parse(cleanText);
            if (parsed.done === true) {
              finishTriage();
              return;
            }
          } catch (_) {}

          // Parse suggestions from format: "question ---اقتراحات: خيار1, خيار2"
          let question = cleanText;
          let suggestions = [];
          const sugMatch = cleanText.match(/---اقتراحات:\s*(.+)/);
          if (sugMatch) {
            question = cleanText.replace(/---اقتراحات:.*$/, '').trim();
            suggestions = sugMatch[1].split(',').map(s => s.trim()).filter(Boolean);
          }

          await showTypingThenAppend(question, 600);
          if (suggestions.length > 0) {
            showSuggestions(suggestions);
          }
          return;
        } catch (e) { lastError = e; }
      }
      console.warn('Qwen failed, falling back to fixed questions:', lastError);
      askFixedQuestion();
    }

    function askFixedQuestion() {
      const step = STATE.triageSession.step;
      if (step >= TRIAGE_QUESTIONS.length) { finishTriage(); return; }
      const q = TRIAGE_QUESTIONS[step];
      document.getElementById('categoryBadge').textContent = q.category;
      updateProgress(step, TRIAGE_QUESTIONS.length);

      const SUGGESTIONS = [
        ['منذ يومين', 'منذ أسبوع', 'منذ ساعات قليلة', 'أكثر من شهر'],
        ['1 - 2', '3 - 5', '6 - 7', '8 - 10'],
        ['لا يوجد', 'ضغط الدم', 'السكري', 'ربو', 'أدوية منتظمة'],
        ['نعم، وتعافيت', 'نعم، ولا زلت أعاني', 'لا، للمرة الأولى'],
        ['لا توجد حساسية', 'حساسية من البنسلين', 'حساسية من الأسبرين'],
      ];

      showTypingThenAppend(q.q).then(() => {
        showSuggestions(SUGGESTIONS[step] || []);
      });
    }

    function startTriage(initialSymptom, breathingContext = '') {
      if (STATE.triageSession.chatLog.length > 0 && !STATE.triageSession.result) {
        showTab('chat');
        return;
      }
      if (!initialSymptom && STATE.triageSession.chatLog.length > 0) {
        showTab('chat');
        return;
      }

      STATE.triageSession = {
        symptom: initialSymptom, chatLog: [], step: 0,
        totalSteps: TRIAGE_MAX_QUESTIONS, category: 'الذكاء الاصطناعي',
        redFlagFired: false, result: null,
      };

      showTab('chat');
      document.getElementById('chatLog').innerHTML = '';
      document.getElementById('redFlagBanner').classList.remove('visible');
      updateProgress(0, TRIAGE_MAX_QUESTIONS);

      const intro = breathingContext
        ? `مرحباً! أنا طبيبك. بناءً على نتيجة تقييم التنفس (${breathingContext})، وعَرَضك المُبلَّغ عنه "${initialSymptom}" — سأطرح عليك بعض الأسئلة الذكية لفهم حالتك بشكل أفضل.`
        : `مرحباً! أنا طبيبك. لاحظتُ عَرَضك: "${initialSymptom}". سأطرح عليك أسئلة ذكية بالذكاء الاصطناعي لفهم حالتك بشكل أفضل. قل "خلاص" أو "اكتفي" متى أردت النتيجة.`;

      appendMessage('bot', intro);
      checkRedFlags(initialSymptom);
      setTimeout(askTriageQwen, 600);
    }

    function handleUserChatInput(imgDataUrl) {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text && !imgDataUrl) return;
      input.value = '';
      appendMessage('user', text, imgDataUrl);
      checkRedFlags(text);
      STATE.triageSession.step++;
      updateProgress(STATE.triageSession.step, TRIAGE_MAX_QUESTIONS);
      if (STATE.triageSession.step < TRIAGE_MAX_QUESTIONS) {
        setTimeout(askTriageQwen, 400);
      } else {
        setTimeout(finishTriage, 600);
      }
    }

    /* ------ Chat file upload (images + PDFs) ------ */
    document.getElementById('chatImgBtn').addEventListener('click', () => {
      document.getElementById('chatImgInput').click();
    });
    document.getElementById('chatImgInput').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { alert('الحد الأقصى لحجم الملف 5 ميجابايت'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        handleUserChatInput(isPdf ? `[PDF: ${file.name}]` : reader.result, isPdf ? reader.result : null);
      };
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    });

    function finishTriage() {
      const fullText = STATE.triageSession.chatLog.map(m => m.text).join(' ').toLowerCase();
      const result = generateTriageResult(fullText, STATE.triageSession.symptom);
      STATE.triageSession.result = result;
      showTypingThenAppend('شكراً على إجاباتك. سأقوم الآن بإعداد تقرير الفحص الشخصي الخاص بك...', 1200)
        .then(() => { displayResults(result); saveSession(); });
    }

    function generateTriageResult(fullText, symptom) {
      const sym = (symptom + ' ' + fullText).toLowerCase();

      const isRed = RED_FLAG_TERMS.some(t => sym.includes(t.toLowerCase()))
        || (sym.includes('شديد') && sym.includes('ألم'))
        || (sym.includes('10') && sym.includes('مقياس'));

      const isOrange = !isRed && (
        sym.includes('حمى') || sym.includes('تقيؤ') || sym.includes('قيء')
        || sym.includes('إسهال') || sym.includes('متوسط')
        || sym.includes('دوار') || sym.includes('التهاب')
      );

      if (isRed) return {
        level: 'red',
        condition: 'أعراض طارئة عالية الخطورة',
        desc: 'الأعراض التي أبلغت عنها تتطابق مع أنماط قد تكون مرتبطة بحالات طبية خطيرة أو مهددة للحياة. يُنصح بشدة بالتقييم الفوري من قِبَل متخصص.',
        recs: [
          'اتصل بخدمات الطوارئ (123) أو توجه فوراً إلى أقرب قسم طوارئ.',
          'لا تقود السيارة بنفسك — اطلب من شخص ما إيصالك أو اتصل بسيارة إسعاف.',
          'احتفظ بقائمة أعراضك وأدويتك الحالية جاهزة للفريق الطبي.',
          'إذا كان لديك دواء طارئ موصوف (مثل نيتروغليسرين أو قلم الأدرينالين)، استخدمه وفقاً للتعليمات.',
        ],
      };

      if (isOrange) return {
        level: 'orange',
        condition: 'قلق معتدل — يُنصح بالرعاية السريعة',
        desc: 'تشير أعراضك إلى مشكلة صحية معتدلة تستوجب الاهتمام المتخصص خلال الساعات القليلة القادمة لتجنب المضاعفات.',
        recs: [
          'زر عيادة الرعاية العاجلة أو تواصل مع طبيبك اليوم.',
          'راقب درجة حرارتك كل 4 ساعات ولاحظ أي تغييرات.',
          'حافظ على ترطيب جيد — اشرب السوائل الصافية بانتظام.',
          'تجنب الجهد البدني الشاق حتى يتم تقييمك.',
          'إذا ساءت الأعراض بشكل ملحوظ، توجه إلى قسم الطوارئ.',
        ],
      };

      return {
        level: 'green',
        condition: 'حالة خفيفة / قابلة للإدارة ذاتياً',
        desc: 'بناءً على إجاباتك، تبدو أعراضك خفيفة ومن المرجح أن تُعالَج بالراحة المناسبة والعناية المنزلية. لا يوجد ما يستدعي التدخل الطارئ الفوري.',
        recs: [
          'استرح جيداً وراقب أعراضك خلال الـ 24 إلى 48 ساعة القادمة.',
          'حافظ على ترطيب جيد وتناول نظاماً غذائياً خفيفاً وسهل الهضم.',
          'استخدم العلاجات المتاحة دون وصفة المناسبة لعَرَضك (حسب التعليمات).',
          'إذا استمرت الأعراض أكثر من 48 ساعة أو ازدادت سوءاً، استشر طبيباً.',
          'تابع مع طبيب الأسرة في موعدك الدوري القادم.',
        ],
      };
    }

    function displayResults(result) {
      const header = document.getElementById('resultsHeader');
      header.className = `results-header glass ${result.level}`;
      document.getElementById('urgencyBadge').innerHTML = result.level === 'red' ? '<i class=" ti ti-urgent" style="color:var(--white)"></i> طارئ' : result.level === 'orange' ? '<i class=" ti ti-alert-triangle" style="color:var(--white)"></i> معتدل' : '<i class=" ti ti-circle-check" style="color:var(--white)"></i> خفيف';
      document.getElementById('conditionTitle').textContent = result.condition;
      document.getElementById('resultsDesc').textContent = result.desc;

      const recList = document.getElementById('recList');
      recList.innerHTML = '';
      result.recs.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        recList.appendChild(li);
      });

      document.getElementById('reportText').value =
        `=== تقرير فحص طبيبك ===\n\nالأعراض: ${STATE.triageSession.symptom}\nالأولوية: ${result.level === 'red' ? 'طارئ' : result.level === 'orange' ? 'معتدل' : 'خفيف'}\nالحالة: ${result.condition}\n\nالتقييم:\n${result.desc}\n\nالتوصيات:\n${result.recs.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nتاريخ التقرير: ${new Date().toLocaleString('ar-EG')}\n\n⚠️ هذا التقرير صادر من الذكاء الاصطناعي وليس تشخيصاً سريرياً.`;

      showTab('results');
    }

    async function saveSession() {
      if (!STATE.currentUser) return;
      const r = STATE.triageSession.result;
      const session = {
        type: 'triage',
        result: JSON.stringify({
          symptom: STATE.triageSession.symptom,
          chatLog: STATE.triageSession.chatLog,
          level: r.level,
          condition: r.condition,
          desc: r.desc,
          recs: r.recs,
        }),
        details: STATE.triageSession.symptom,
      };
      try {
        const saved = await api('POST', '/api/sessions', session);
        STATE.sessions.unshift(saved);
      } catch (e) {
        STATE.sessions.unshift({
          id: Date.now(),
          ...session,
          createdAt: new Date().toISOString(),
        });
      }
    }

    document.getElementById('startTriageBtn').addEventListener('click', () => {
      const sym = document.getElementById('symptomInput').value.trim();
      if (!sym) { alert('يرجى وصف أعراضك قبل البدء.'); return; }
      startTriage(sym);
    });

    document.getElementById('symptomInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('startTriageBtn').click();
      }
    });

    document.getElementById('sendBtn').addEventListener('click', handleUserChatInput);
    document.getElementById('chatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUserChatInput();
      }
    });

    /* ------ Arrow key navigation between tabs (RTL-aware) ------ */
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const navOrder = ['landing', 'meds', 'history', 'food', 'medical-test', 'bmi', 'pharmacist', 'mentor'];
        const current = STATE.currentTab;
        let idx = navOrder.indexOf(current);
        if (idx === -1) idx = 0;
        // In RTL: right arrow → previous (index-1), left arrow → next (index+1)
        if (e.key === 'ArrowRight') idx = Math.max(idx - 1, 0);
        if (e.key === 'ArrowLeft') idx = Math.min(idx + 1, navOrder.length - 1);
        const target = navOrder[idx];
        if (target === 'landing' && STATE.triageSession.chatLog.length > 0 && !STATE.triageSession.result) {
          showTab('chat');
        } else {
          showTab(target);
        }
      }
    });

    /* ------ Swipe gesture navigation (mobile) ------ */
    let touchStartX = 0;
    document.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) < 50) return;
      const navOrder = ['landing', 'meds', 'history', 'food', 'medical-test', 'bmi', 'pharmacist', 'mentor'];
      const current = STATE.currentTab;
      let idx = navOrder.indexOf(current);
      if (idx === -1) idx = 0;
      if (diff > 0) idx = Math.max(idx - 1, 0);  // swipe left → prev tab
      else idx = Math.min(idx + 1, navOrder.length - 1);  // swipe right → next tab
      const target = navOrder[idx];
      if (target === 'landing' && STATE.triageSession.chatLog.length > 0 && !STATE.triageSession.result) {
        showTab('chat');
      } else {
        showTab(target);
      }
    }, { passive: true });

    /* ------ Double-tap/click landing to skip intro ------ */
    const landingEl = document.getElementById('screen-landing');
    let lastLandingTouch = 0;
    if (landingEl) {
      // Desktop: native double-click
      landingEl.addEventListener('dblclick', e => {
        if (!STATE.currentUser) return;
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        showTab('meds');
      });
      // Mobile: custom double-tap via touch events
      landingEl.addEventListener('touchend', e => {
        if (!STATE.currentUser) return;
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        const now = Date.now();
        if (now - lastLandingTouch < 400) {
          e.preventDefault();
          showTab('meds');
          lastLandingTouch = 0;
        } else {
          lastLandingTouch = now;
        }
      });
    }

    document.getElementById('restartBtn').addEventListener('click', () => {
      document.getElementById('symptomInput').value = '';
      showTab('landing');
    });

    document.getElementById('copyReportBtn').addEventListener('click', () => {
      const ta = document.getElementById('reportText');
      ta.select();
      navigator.clipboard.writeText(ta.value).catch(() => document.execCommand('copy'));
      document.getElementById('copyReportBtn').textContent = '✓ تم النسخ!';
      setTimeout(() => document.getElementById('copyReportBtn').textContent = 'نسخ التقرير الطبي', 2000);
    });

    document.getElementById('foodFromTriageBtn').addEventListener('click', () => {
      const result = STATE.triageSession.result;
      const condition = result?.condition || STATE.triageSession.symptom || '';
      showTab('food');
      document.getElementById('foodCustomInput').value = condition;
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      STATE.food.selectedMood = '';
      document.getElementById('foodGetBtn').click();
    });

    /* ================================================================
       BREATHING TEST
       ================================================================ */
    const BREATHING_PHASES = [
      { name: 'شهيق', dur: 4, cls: 'inhale', freq: 528 },
      { name: 'احبس', dur: 4, cls: 'hold', freq: 396 },
      { name: 'زفير', dur: 6, cls: 'exhale', freq: 432 },
    ];

    document.getElementById('startBreathingBtn').addEventListener('click', () => {
      warmUpAudio();
      STATE.breathing = { cycle: 0, totalCycles: 3, scores: [], timerHandle: null, phase: 'ready', breathResult: null, muted: STATE.breathing.muted };
      showTab('breathing');
      document.getElementById('difficultyPanel').style.display = 'none';
      document.getElementById('breathResults').style.display = 'none';
      document.getElementById('breathCancelWrap').style.display = '';
      document.getElementById('breathStartWrap').style.display = '';
      document.getElementById('circleWrapperEl').style.display = 'none';
      if ('speechSynthesis' in window) speechSynthesis.getVoices();
    });

    document.getElementById('breathStartBtn').addEventListener('click', () => {
      warmUpAudio();
      document.getElementById('breathStartWrap').style.display = 'none';
      document.getElementById('circleWrapperEl').style.display = '';
      setTimeout(runBreathingCycle, 1500);
    });
    function runBreathingCycle() {
      document.getElementById('cycleBadge').textContent = `الدورة ${STATE.breathing.cycle + 1} من ${STATE.breathing.totalCycles}`;
      let phaseIdx = 0;

      function runPhase() {
        if (phaseIdx >= BREATHING_PHASES.length) {
          document.getElementById('breathCircle').className = 'breath-circle';
          document.getElementById('phaseLabel').textContent = 'تم';
          document.getElementById('phaseTimer').textContent = '';
          speakPhase('اكتملت الدورة. كيف شعرت؟');
          document.getElementById('difficultyPanel').style.display = '';
          return;
        }
        const phase = BREATHING_PHASES[phaseIdx];
        document.getElementById('breathCircle').className = `breath-circle ${phase.cls}`;
        document.getElementById('phaseLabel').textContent = phase.name;
        playChime(phase.freq, 1.0);
        speakPhase(phase.name);
        let t = phase.dur;
        document.getElementById('phaseTimer').textContent = t;
        const tick = setInterval(() => {
          t--;
          document.getElementById('phaseTimer').textContent = t > 0 ? t : '';
          if (t <= 0) { clearInterval(tick); phaseIdx++; runPhase(); }
        }, 1000);
        STATE.breathing.timerHandle = tick;
      }
      runPhase();
    }

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.breathing.scores.push(btn.dataset.diff);
        STATE.breathing.cycle++;
        document.getElementById('difficultyPanel').style.display = 'none';
        if (STATE.breathing.cycle < STATE.breathing.totalCycles) {
          runBreathingCycle();
        } else {
          showBreathingResults();
        }
      });
    });

    function showBreathingResults() {
      document.getElementById('breathCancelWrap').style.display = 'none';
      const scores = STATE.breathing.scores;
      const hardCt = scores.filter(s => s === 'hard').length;
      const modCt = scores.filter(s => s === 'moderate').length;
      const rawScore = Math.round(10 - hardCt * 3.5 - modCt * 1.5);
      const score = Math.max(0, Math.min(10, rawScore));

      let level, title, desc, bgColor;
      if (hardCt >= 2 || (hardCt === 1 && modCt >= 1)) {
        level = 'red'; title = 'صعوبة تنفس ملحوظة';
        desc = 'أبلغت عن صعوبة كبيرة في التنفس خلال التقييم. قد يشير هذا إلى حالة تنفسية تستوجب عناية طبية.';
        bgColor = 'var(--red)';
        speakPhase('اكتمل التقييم. تم رصد صعوبة تنفس ملحوظة. يُرجى استشارة طبيب.');
      } else if (modCt >= 2 || hardCt === 1) {
        level = 'orange'; title = 'إجهاد تنفسي معتدل';
        desc = 'واجهت بعض الصعوبة خلال دورات التنفس. فكّر في التحدث مع مختص لتقييم صحتك التنفسية.';
        bgColor = 'var(--orange)';
        speakPhase('اكتمل التقييم. تم رصد إجهاد تنفسي معتدل.');
      } else {
        level = 'green'; title = 'نمط تنفس طبيعي';
        desc = 'أتممت الدورات الثلاث بارتياح. يبدو أن وظيفتك التنفسية طبيعية بناءً على هذا التقييم الذاتي.';
        bgColor = 'var(--green)';
        speakPhase('اكتمل التقييم. نمط التنفس يبدو طبيعياً. أحسنت!');
      }

      STATE.breathing.breathResult = { level, title, desc, score };
      document.getElementById('breathResultCard').className = `result-card ${level}`;
      document.getElementById('breathScoreCircle').className = `score-circle ${level}`;
      document.getElementById('breathScoreNum').textContent = score;
      document.getElementById('breathResultTitle').textContent = title;
      document.getElementById('breathResultDesc').textContent = desc;

      const urgEl = document.getElementById('breathUrgency');
      urgEl.innerHTML = level === 'red'
        ? '<i class="ti ti-alert-triangle"></i> راجع طبيباً'
        : level === 'orange'
          ? '<i class="ti ti-alert-circle"></i> راقب الأعراض'
          : '<i class="ti ti-circle-check"></i> ضمن المعدل الطبيعي';
      urgEl.style.background = bgColor;
      document.getElementById('breathResults').style.display = '';
    }

    document.getElementById('breathToTriageBtn').addEventListener('click', () => {
      const r = STATE.breathing.breathResult;
      const sym = document.getElementById('symptomInput').value.trim() || 'صعوبة في التنفس';
      startTriage(sym, `${r.title} (درجة ${r.score}/10)`);
    });

    document.getElementById('breathRestartBtn').addEventListener('click', () => {
      warmUpAudio();
      STATE.breathing = { cycle: 0, totalCycles: 3, scores: [], timerHandle: null, phase: 'ready', breathResult: null, muted: STATE.breathing.muted };
      document.getElementById('difficultyPanel').style.display = 'none';
      document.getElementById('breathResults').style.display = 'none';
      document.getElementById('breathCancelWrap').style.display = '';
      document.getElementById('circleWrapperEl').style.display = '';
      document.getElementById('breathStartWrap').style.display = 'none';
      speakPhase('إعادة البدء. استعد.');
      setTimeout(runBreathingCycle, 1200);
    });

    document.getElementById('breathBackBtn').addEventListener('click', () => {
      clearInterval(STATE.breathing.timerHandle);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      showTab('landing');
    });

    document.getElementById('breathCancelBtn').addEventListener('click', () => {
      clearInterval(STATE.breathing.timerHandle);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      showTab('landing');
    });

    /* ================================================================
       BMI CALCULATOR
       ================================================================ */
    document.getElementById('bmiCalcBtn').addEventListener('click', () => {
      const height = parseFloat(document.getElementById('bmiHeight').value);
      const weight = parseFloat(document.getElementById('bmiWeight').value);
      const age = parseInt(document.getElementById('bmiAge').value, 10);
      const gender = document.getElementById('bmiGender').value;
      if (!height || !weight || !age) { alert('يرجى ملء جميع الحقول لحساب مؤشر كتلة الجسم.'); return; }
      displayBMIResult(weight / ((height / 100) ** 2), age, gender);
    });

    function displayBMIResult(bmi, age, gender) {
      const card = document.getElementById('bmiResultCard');
      card.style.display = '';
      let current = 0;
      const target = parseFloat(bmi.toFixed(1));
      const step = target / 30;
      const valueEl = document.getElementById('bmiValue');
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        valueEl.textContent = current.toFixed(1);
        if (current >= target) clearInterval(timer);
      }, 20);

      let cat, catClass, catDesc;
      if (bmi < 18.5) {
        cat = 'نحيف'; catClass = 'underweight';
        catDesc = 'مؤشر كتلة جسمك أقل من النطاق الصحي. يُنصح بزيادة السعرات الحرارية بالأطعمة الغنية بالمغذيات.';
      } else if (bmi < 25) {
        cat = 'وزن طبيعي'; catClass = 'normal';
        catDesc = 'مؤشر كتلة جسمك ضمن النطاق الصحي. حافظ على نمط حياتك الحالي بتغذية متوازنة وتمارين منتظمة.';
      } else if (bmi < 30) {
        cat = 'زيادة وزن'; catClass = 'overweight';
        catDesc = 'مؤشر كتلة جسمك أعلى قليلاً من النطاق الصحي. يُنصح بمزيج من التعديلات الغذائية وزيادة النشاط البدني.';
      } else {
        cat = 'سمنة'; catClass = 'obese';
        catDesc = 'يشير مؤشر كتلة جسمك إلى سمنة. يُنصح باستشارة مقدم الرعاية الصحية لوضع خطة إدارة وزن منظمة.';
      }

      document.getElementById('bmiCircle').className = `bmi-circle ${catClass}`;
      document.getElementById('bmiCatBadge').className = `bmi-cat-badge ${catClass}`;
      document.getElementById('bmiCatBadge').textContent = cat;
      document.getElementById('bmiCatDesc').textContent = catDesc;

      // RTL fix: flip the percentage so the ball moves correctly
      // نحيف (right) = low BMI, سمنة (left) = high BMI
      const pct = Math.max(0, Math.min(100, ((bmi - 15) / 25) * 100));
      const rtlPct = 100 - pct;
      setTimeout(() => { document.getElementById('gaugePointer').style.left = `${rtlPct}%`; }, 100);
      const tips = buildBMITips(bmi, age, gender);
      document.getElementById('tipsList').innerHTML = tips.map(t => `<li>${t}</li>`).join('');

      // Save BMI result to STATE and localStorage
      STATE.bmi = {
        value: target,
        category: cat,
        class: catClass,
        age: age,
        gender: gender === 'male' || gender === 'ذكور' || gender === 'ذكر' ? 'ذكر' : 'أنثى'
      };
      try {
        localStorage.setItem('tabibak_bmi', JSON.stringify(STATE.bmi));
      } catch (e) { }

      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function buildBMITips(bmi, age, gender) {
      const tips = [];
      if (bmi < 18.5) {
        tips.push('احرص على تناول 5 إلى 6 وجبات صغيرة خلال اليوم بدلاً من 3 وجبات كبيرة.');
        tips.push('أدرج أطعمة غنية بالسعرات ومغذية: المكسرات والأفوكادو والحبوب الكاملة والبقوليات.');
        tips.push('مارس تمارين مقاومة خفيفة لبناء كتلة عضلية صحية.');
        if (age > 50) tips.push('تحدث مع طبيبك حول كثافة العظام، فانخفاض المؤشر يؤثر على الصحة الهيكلية.');
      } else if (bmi < 25) {
        tips.push('واصل تناول وجبات متوازنة تحتوي على البروتين والكربوهيدرات المعقدة والدهون الصحية.');
        tips.push('احرص على ممارسة 150 دقيقة على الأقل من النشاط الهوائي المعتدل أسبوعياً.');
        tips.push('أعطِ الأولوية لنوم جيد (7-9 ساعات) للحفاظ على الصحة الأيضية.');
        if (gender === 'أنثى') tips.push('احرصي على تناول الكالسيوم والحديد الكافيين، فهما مهمان بشكل خاص للمرأة.');
      } else if (bmi < 30) {
        tips.push('قلّل السكريات المكررة والأطعمة المصنّعة واختر بدائل الأطعمة الكاملة.');
        tips.push('احرص على عجز يومي بالسعرات الحرارية يتراوح بين 300 و500 سعرة مع التمرين.');
        tips.push('المشي 10,000 خطوة يومياً نقطة بداية فعّالة وذات تأثير منخفض.');
        if (age > 40) tips.push('فكّر في فحص القلب والأوعية الدموية، إذ يزيد الوزن الزائد من مخاطر أمراض القلب.');
      } else {
        tips.push('استشر طبيبك قبل البدء بأي برنامج لفقدان الوزن.');
        tips.push('ابدأ بأنشطة منخفضة التأثير (السباحة، ركوب الدراجة) لحماية المفاصل.');
        tips.push('النظام الغذائي المتوسطي يتمتع بأدلة قوية على الفاعلية المستدامة لفقدان الوزن.');
        tips.push('ضع أهدافاً واقعية وتدريجية — فقدان 0.5 إلى 1 كجم أسبوعياً صحي وقابل للاستمرار.');
        if (gender === 'ذكر' && age > 45) tips.push('اطلب فحص دم لمراقبة الكوليسترول وسكر الدم وضغط الدم.');
      }
      return tips;
    }

    document.getElementById('bmiResetBtn').addEventListener('click', () => {
      document.getElementById('bmiResultCard').style.display = 'none';
      ['bmiHeight', 'bmiWeight', 'bmiAge'].forEach(id => document.getElementById(id).value = '');
    });

    /* ================================================================
       NUTRITION ADVISOR
       ================================================================ */
    const FOOD_FALLBACK = {
      'nausea and upset stomach': {
        badge: 'غثيان / اضطراب المعدة',
        cards: [
          { icon: '<i class="ti ti-bowl" style="color:#F97316"></i>', title: 'تناوَل', items: ['أرز أبيض سادة', 'بسكويت المالح', 'الموز (حمية BRAT)', 'صدر دجاج مسلوق', 'خبز محمص سادة'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'اشرب', items: ['شاي الزنجبيل (مضاد للغثيان)', 'ماء مع إلكتروليتات', 'شاي النعناع'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['الأطعمة الحارة', 'الوجبات الدهنية والمقلية', 'منتجات الألبان', 'الكافيين'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['تناوَل كميات صغيرة كل ساعتين', 'اجلس مستقيماً بعد الأكل', 'احتفظ بحلوى الزنجبيل معك', 'تجنَّب الروائح القوية'] },
        ],
      },
      'fever and high body temperature': {
        badge: 'حمى',
        cards: [
          { icon: '<i class="ti ti-bowl" style="color:#F97316"></i>', title: 'تناوَل', items: ['مرق دجاج دافئ', 'بيض مسلوق ناعم', 'شوفان مطبوخ', 'زبادي (بروبيوتيك)'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'اشرب', items: ['ماء (2-3 لتر/يوم)', 'ماء جوز الهند', 'شاي أعشاب', 'محاليل معالجة الجفاف الفموية'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['الكحول', 'الكافيين (مدرّ للبول)', 'البروتينات الثقيلة', 'المشروبات السكرية'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['استرح وحافظ على البرودة', 'راقب درجة الحرارة كل 4 ساعات', 'تناوَل الباراسيتامول إذا تجاوزت 38.5°م'] },
        ],
      },
      'headache and migraine': {
        badge: 'صداع / شقيقة',
        cards: [
          { icon: '<i class="ti ti-bowl" style="color:#F97316"></i>', title: 'تناوَل', items: ['اللوز الغني بالمغنيسيوم', 'الشوكولاتة الداكنة (كمية صغيرة)', 'السلمون (أوميغا 3)', 'الخضروات الورقية'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'اشرب', items: ['الكثير من الماء', 'شاي الزنجبيل', 'شاي النعناع', 'مشروبات الإلكتروليتات'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['الكحول (خاصة النبيذ الأحمر)', 'الأجبان المعتقة', 'اللحوم المصنّعة (النترات)', 'الأطعمة المحتوية على MSG'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['استرح في غرفة مظلمة وهادئة', 'ضع كمادة باردة/دافئة', 'مارس التنفس العميق'] },
        ],
      },
      'fatigue and low energy': {
        badge: 'إرهاق / انخفاض الطاقة',
        cards: [
          { icon: '<i class="ti ti-meat" style="color:#F97316"></i>', title: 'تناوَل', items: ['لحم خالٍ من الدهن غني بالحديد', 'العدس والبقوليات', 'الكينوا', 'بذور اليقطين'] },
          { icon: '<i class="ti ti-coffee" style="color:#6F4E37"></i>', title: 'اشرب', items: ['الشاي الأخضر (L-theanine)', 'الماء (8 أكواب)', 'ماتشا', 'عصائر السبانخ'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'تجنَّب', items: ['ارتفاع السكر المفاجئ (حلوى، مشروبات غازية)', 'تخطي الفطور', 'الكحول الزائد', 'الغدا الثقيل'] },
          { icon: '<i class="ti ti-bulb" style="color:#EAB308"></i>', title: 'نصائح', items: ['نَم 7-9 ساعات ليلاً', 'قم بمشي قصير 10 دقائق', 'افحص مستوى الحديد وفيتامين د'] },
        ],
      },
      default: {
        badge: 'الصحة العامة',
        cards: [
          { icon: '<i class="ti ti-salad" style="color:#22C55E"></i>', title: 'وجبات متوازنة', items: ['نصف الطبق خضروات', 'ربع الطبق بروتين خالٍ من الدهن', 'ربع الطبق حبوب كاملة', 'تنوع الألوان'] },
          { icon: '<i class="ti ti-droplet" style="color:#3B82F6"></i>', title: 'الترطيب', items: ['8 أكواب ماء يومياً', 'شاي أعشاب', 'ماء بالفاكهة', 'حليب منخفض الدسم'] },
          { icon: '<i class="ti ti-ban" style="color:#EF4444"></i>', title: 'حدِّد هذه', items: ['الأطعمة فائقة المعالجة', 'السكر المكرر الزائد', 'الدهون المتحولة (المقلية)', 'الصوديوم الزائد'] },
          { icon: '<i class="ti ti-heart-rate-monitor"style="color:#EC4899"></i>', title: 'عادات يومية', items: ['تناوَل الطعام في أوقات منتظمة', '30 دقيقة حركة يومياً', 'الأكل الواعي (بدون شاشات)', 'اقرأ قيم التغذية'] },
        ],
      },
    };


    const GROQ_API_KEY = ''; // loaded dynamically from backend config to prevent git leaks

    function getDislikedFoods() {
      const username = STATE.currentUser ? STATE.currentUser.username : 'guest';
      try {
        const stored = localStorage.getItem(`tabibak_disliked_foods_${username}`);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }

    function saveDislikedFoods(list) {
      const username = STATE.currentUser ? STATE.currentUser.username : 'guest';
      try {
        localStorage.setItem(`tabibak_disliked_foods_${username}`, JSON.stringify(list));
      } catch (e) {
        console.error("Failed to save disliked foods:", e);
      }
    }

    async function getFoodRecsFromAI(mood, allKeys) {

      // ── 1. Build user health context from STATE ──────────────
      const user = STATE.currentUser;
      let userContext = '';

      if (user) {
        userContext += '\n\n👤 معلومات المريض الشخصية والتاريخ الطبي:';
        if (user.name) userContext += `\n- الاسم: ${user.name}`;
        if (user.age) userContext += `\n- العمر: ${user.age} سنة`;
        if (user.gender) userContext += `\n- الجنس: ${user.gender === 'male' || user.gender === 'ذكور' || user.gender === 'ذكر' ? 'ذكر' : 'أنثى'}`;
        if (user.history) userContext += `\n- التاريخ المرضي والأمراض المزمنة أو الحساسية: ${user.history}`;
      }

      // Add BMI Context if available
      if (STATE.bmi) {
        userContext += `\n- مؤشر كتلة الجسم الحالي (BMI): ${STATE.bmi.value} (التصنيف: ${STATE.bmi.category})`;
      }

      // Add Breathing Test Context if available
      if (STATE.breathing?.breathResult) {
        const br = STATE.breathing.breathResult;
        userContext += `\n- نتيجة اختبار التنفس الأخير: ${br.title} (الدرجة: ${br.score}/10، التوصية: ${br.desc})`;
      }

      // Active Medications
      if (STATE.meds?.list?.length > 0) {
        userContext += '\n\n💊 الأدوية الحالية التي يتناولها المريض (تنبيه: تحقق من التفاعلات بين الدواء والغذاء والتعارضات):';
        STATE.meds.list.forEach(m => {
          userContext += `\n- ${m.name} ${m.dose || ''} (${m.form || ''}) — إرشادات الطعام: ${m.food || 'غير محدد'}`;
          if (m.note) userContext += ` — ملاحظة إضافية: ${m.note}`;
        });
      }

      // Past symptoms/sessions history
      if (STATE.sessions?.length > 0) {
        userContext += '\n\n🩺 السجل الطبي للجلسات السابقة وأعراض المريض الأخيرة:';
        // Summary of up to 3 past sessions to identify patterns
        const pastSessions = STATE.sessions.slice(0, 3).map(parseSession);
        pastSessions.forEach((s, idx) => {
          userContext += `\nجلسة ${idx + 1}:`;
          if (s.createdAt) userContext += ` التاريخ: ${new Date(s.createdAt).toLocaleDateString('ar-EG')}`;
          if (s.condition) userContext += ` | التشخيص المقدر: ${s.condition}`;
          if (s.symptom) userContext += ` | الأعراض المذكورة: ${s.symptom}`;
          if (s.desc) userContext += ` | الوصف الطبي: ${s.desc}`;
        });
      }

      const dislikedList = getDislikedFoods();

      // ── 2. Build the personalized prompt ─────────────────────
      const hasContext = userContext.length > 0;

      const prompt = `أنت مستشار تغذية محايد تعمل بناءً على الأدلة العلمية فقط. حلل بيانات المستخدم المقدمة أدناه وأصدر توصيات غذائية موضوعية بناءً على المعلومات المتاحة. لا تفترض أي حالة صحية غير مؤكدة. اعتمد فقط على البيانات المقدمة في هذا السياق.

بيانات المستخدم الحالية المتاحة:
${hasContext ? userContext : 'لا تتوفر معلومات صحية سابقة للملف الشخصي.'}
${dislikedList.length > 0 ? `\n⚠️ الأطعمة التي يكرهها أو لا يفضلها المستخدم ويجب تجنبها تماماً واستبدالها ببدائل صحية ومناسبة في الخطة: ${dislikedList.join('، ')}` : ''}

الموضوع / سبب الطلب: "${mood}"

تعليمات:
1. حلل أياً من البيانات التالية إن وُجدت: الأدوية، الحالات المرضية، مؤشر كتلة الجسم، الفحوصات، الأعراض السابقة.
2. إذا وُجدت أدوية: افحص أي تداخل دوائي-غذائي معروف علمياً واذكره في "drugWarnings".
3. في "analysis" اكتب 3-4 جمل تحليلية توضح العلاقة بين البيانات المتاحة والتوصيات (بالعربية الفصحى).
4. في "cards" ضع 4 أقسام كالتالي:
   - "أطعمة مستحبة": أطعمة مفيدة بناءً على البيانات.
   - "مشروبات وسوائل مستحبة": مشروبات مفيدة.
   - "تجنَّب تماماً": أطعمة قد تتعارض مع البيانات. ويجب تجنب وإقصاء أي طعام يكرهه المستخدم تماماً (المدرج في القائمة أعلاه إن وجد).
   - "نصائح نمط الحياة والتغذية العلاجية": إرشادات عامة.
5. كل عنصر في "items" يجب أن يحتوي على "name" و "reason" (سبب علمي مبني على الأدلة).
6. إذا لم تتوفر بيانات كافية، اذكر ذلك بوضوح في التحليل وقدم توصيات عامة متوازنة.
7. أخرج JSON صالحاً مطابقاً للهيكل التالي:

{
  "badge": "عنوان قصير للتوصيات",
  "analysis": "تحليل موضوعي يربط البيانات المتاحة بالتوصيات",
  "drugWarnings": [
    "تحذير دوائي-غذائي إن وجد، أو اكتب 'لا توجد تعارضات معروفة بناءً على البيانات المقدمة'"
  ],
  "cards": [
    {
      "icon": "🥦",
      "title": "أطعمة مستحبة",
      "items": [
        {"name": "طعام", "reason": "السبب العلمي المبني على البيانات المتاحة"}
      ]
    },
    {
      "icon": "🥛",
      "title": "مشروبات وسوائل مستحبة",
      "items": [
        {"name": "مشروب", "reason": "السبب العلمي"}
      ]
    },
    {
      "icon": "🚫",
      "title": "تجنَّب تماماً",
      "items": [
        {"name": "طعام", "reason": "السبب العلمي"}
      ]
    },
    {
      "icon": "💡",
      "title": "نصائح نمط الحياة والتغذية العلاجية",
      "items": [
        {"name": "نصيحة", "reason": "التوجيه المبني على البيانات"}
      ]
    }
  ]
}`;

      // ── 3. Call Groq API — works directly from the browser ───
      async function callGroq(promptText, allKeys) {
        const qwen = 'qwen/qwen3-32b';
        const llama = 'llama-3.3-70b-versatile';
        const pref = STATE.food.preferredModel;
        const primaryKey = allKeys[0];

        const tryModel = async (key, model) => {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({
              model,
              temperature: 0.2,
              max_tokens: 2000,
              messages: [
                { role: 'system', content: 'أنت مستشار تغذية محايد. حلل البيانات المقدمة وأخرج JSON صالحاً فقط.' },
                { role: 'user', content: promptText },
              ],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const raw = data.choices?.[0]?.message?.content;
            if (!raw) throw new Error('لم يرد Groq بأي محتوى');
            let clean = raw.replace(/```json|```/g, '').trim();
            clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            clean = clean.replace(/<think>/gi, '').trim();
            const jsonStart = clean.indexOf('{');
            const jsonEnd = clean.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
              clean = clean.substring(jsonStart, jsonEnd + 1);
            } else {
              throw new Error('الرد لا يحتوي على JSON صالح');
            }
            STATE.food.lastModelUsed = model;
            return { ok: true, data: safeJsonParse(repairJSON(clean)) };
          }
          const err = await res.json().catch(() => ({}));
          const msg = err.error?.message || 'فشل الاتصال';
          if (res.status === 401) return { ok: false, fatal: true, error: new Error('مفتاح Groq غير صحيح') };
          if (res.status === 503) return { ok: false, fatal: true, error: new Error('خدمة Groq غير متاحة مؤقتاً — حاول بعد قليل') };
          if (res.status === 429) return { ok: false, fatal: false };
          return { ok: false, fatal: true, error: new Error(`Groq ${res.status}: ${msg}`) };
        };

        const primaryModel = pref === 'llama' ? llama : qwen;
        const fallbackModel = pref === 'llama' ? qwen : llama;

        // Phase 1: try primary model on all keys
        for (const key of allKeys) {
          const r = await tryModel(key, primaryModel);
          if (r.ok) return r.data;
          if (r.fatal) throw r.error;
        }

        // Phase 2: cycle re-check primary on org1 ↔ fallback on each key
        for (const llmKey of allKeys) {
          const q = await tryModel(primaryKey, primaryModel);
          if (q.ok) return q.data;
          if (q.fatal) throw q.error;
          const f = await tryModel(llmKey, fallbackModel);
          if (f.ok) return f.data;
          if (f.fatal) throw f.error;
        }

        throw new Error('فشلت جميع محاولات الاتصال بالنماذج');
      }

      return await callGroq(prompt, allKeys);
    }

    function renderFoodCards(data, clearChat = true) {
      document.getElementById('foodConditionBadge').textContent = data.badge;

      // Show model badge
      const modelBadge = document.getElementById('foodModelBadge');
      const modelName = STATE.food.lastModelUsed || '';
      if (modelName.includes('qwen')) {
        modelBadge.textContent = '🧠 Qwen 3 32B';
        modelBadge.style.display = '';
      } else if (modelName.includes('llama')) {
        modelBadge.textContent = '🦙 Llama 3.3 70B';
        modelBadge.style.display = '';
      } else {
        modelBadge.style.display = 'none';
      }

      // Render clinical analysis if it exists
      const analysisCard = document.getElementById('foodAnalysisCard');
      const analysisText = document.getElementById('foodAnalysisText');
      if (data.analysis) {
        analysisText.textContent = data.analysis;
        analysisCard.style.display = '';
      } else {
        analysisCard.style.display = 'none';
      }

      // Render drug warnings if they exist and contain active warnings
      const warningsCard = document.getElementById('foodWarningsCard');
      const warningsList = document.getElementById('foodWarningsList');
      const hasWarnings = data.drugWarnings && data.drugWarnings.length > 0 &&
        !data.drugWarnings.every(w => w.includes('لا توجد') || w.toLowerCase().includes('no known') || w.toLowerCase().includes('no interactions'));
      if (hasWarnings && STATE.meds?.list?.length > 0) {
        warningsList.innerHTML = data.drugWarnings.map(w => `<li>${w}</li>`).join('');
        warningsCard.style.display = '';
      } else {
        warningsCard.style.display = 'none';
      }

      // Render cards
      document.getElementById('foodCards').innerHTML = data.cards.map(card => {
        let iconHtml = card.icon;
        if (!iconHtml.includes('<')) {
          iconHtml = `<span>${card.icon}</span>`;
        }

        return `
          <div class="food-card">
            <span class="food-card-icon">${iconHtml}</span>
            <span class="food-card-title">${card.title}</span>
            <ul class="food-card-items">
              ${card.items.map(item => {
          const name = typeof item === 'object' ? item.name : item;
          const reason = typeof item === 'object' ? item.reason : '';
          return `
                  <li>
                    <div class="food-item-wrapper">
                      <span class="food-item-name">${name}</span>
                      ${reason ? `<span class="food-item-reason">${reason}</span>` : ''}
                    </div>
                  </li>
                `;
        }).join('')}
            </ul>
          </div>
        `;
      }).join('');

      document.getElementById('foodResults').style.display = '';

      // Show the food chat area for follow-up modifications
      if (clearChat) {
        document.getElementById('foodChatLog').innerHTML = '';
        document.getElementById('foodChatInput').value = '';
      }
      document.getElementById('foodChatArea').style.display = '';
      document.getElementById('foodChatModelLabel').textContent = STATE.food.preferredModel === 'llama' ? '🦙 Llama' : '🧠 Qwen';
      document.getElementById('foodActions').style.display = 'flex';
    }

    async function fetchFoodRecommendations(mood) {
      document.getElementById('foodLoading').style.display = '';
      document.getElementById('foodResults').style.display = 'none';
      document.getElementById('foodError').style.display = 'none';
      document.getElementById('foodChatArea').style.display = 'none';
      document.getElementById('foodActions').style.display = 'none';
      STATE.food.chatLog = [];
      STATE.food.currentMood = mood;
      STATE.food.savedSessionId = null;
      try {
        let data;
        if (STATE.food.apiKey) {
          const keys = STATE.apiKeys.length > 0 ? STATE.apiKeys : [STATE.food.apiKey];
          data = await getFoodRecsFromAI(mood, keys);
        } else {
          await new Promise(r => setTimeout(r, 700));
          data = FOOD_FALLBACK[mood] || FOOD_FALLBACK['default'];
        }
        STATE.food.currentData = data;
        renderFoodCards(data);
        if (STATE.currentUser) saveFoodSession();
      } catch (e) {
        console.warn('Food AI failed, using fallback:', e.message);
        await new Promise(r => setTimeout(r, 300));
        const fallback = FOOD_FALLBACK[mood] || FOOD_FALLBACK['default'];
        STATE.food.currentData = fallback;
        renderFoodCards(fallback);
        if (STATE.currentUser) saveFoodSession();
      } finally {
        document.getElementById('foodLoading').style.display = 'none';
      }
    }

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        STATE.food.selectedMood = chip.dataset.mood;
        document.getElementById('foodCustomInput').value = '';
      });
    });

    document.getElementById('foodModelToggle').addEventListener('click', () => {
      const isLlama = STATE.food.preferredModel === 'llama';
      if (isLlama) {
        STATE.food.preferredModel = '';
        document.getElementById('foodModelIndicator').textContent = '🧠';
        document.getElementById('foodModelLabel').textContent = 'Qwen 3 32B (تلقائي)';
      } else {
        STATE.food.preferredModel = 'llama';
        document.getElementById('foodModelIndicator').textContent = '🦙';
        document.getElementById('foodModelLabel').textContent = 'Llama 3.3 70B';
      }
    });

    document.getElementById('foodChatModelToggle').addEventListener('click', () => {
      const isLlama = STATE.food.preferredModel === 'llama';
      if (isLlama) {
        STATE.food.preferredModel = '';
        document.getElementById('foodChatModelLabel').textContent = '🧠 Qwen';
      } else {
        STATE.food.preferredModel = 'llama';
        document.getElementById('foodChatModelLabel').textContent = '🦙 Llama';
      }
    });

    document.getElementById('foodGetBtn').addEventListener('click', () => {
      const custom = document.getElementById('foodCustomInput').value.trim();
      const mood = custom || STATE.food.selectedMood;
      if (!mood) { alert('يرجى اختيار شعور أو وصف حالتك.'); return; }
      fetchFoodRecommendations(mood);
    });

    document.getElementById('foodResetBtn').addEventListener('click', () => {
      document.getElementById('foodResults').style.display = 'none';
      document.getElementById('foodChatArea').style.display = 'none';
      document.getElementById('foodActions').style.display = 'none';
      document.getElementById('foodError').style.display = 'none';
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      document.getElementById('foodCustomInput').value = '';
      STATE.food.selectedMood = '';
      STATE.food.currentData = null;
      STATE.food.currentMood = '';
      STATE.food.chatLog = [];
      STATE.food.savedSessionId = null;
      STATE.food.lastModelUsed = '';
      document.getElementById('foodModelBadge').style.display = 'none';
    });

    async function handleFoodChat() {
      const input = document.getElementById('foodChatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      const chatLog = document.getElementById('foodChatLog');

      // Append user message
      const userMsg = document.createElement('div');
      userMsg.style.cssText = 'align-self:flex-end;background:var(--primary);color:white;padding:0.4rem 0.8rem;border-radius:12px 12px 4px 12px;max-width:85%;font-size:0.85rem;word-break:break-word;';
      userMsg.textContent = text;
      chatLog.appendChild(userMsg);

      STATE.food.chatLog.push({ role: 'user', text });

      // Show typing indicator
      const typing = document.createElement('div');
      typing.style.cssText = 'align-self:flex-start;color:var(--text-2);font-size:0.8rem;padding:0.3rem 0;';
      typing.textContent = 'جارٍ تعديل القائمة...';
      chatLog.appendChild(typing);
      chatLog.scrollTop = chatLog.scrollHeight;

      try {
        const currentData = STATE.food.currentData;
        if (!currentData) throw new Error('لا توجد بيانات غذائية حالية');

        const apiKey = STATE.food.apiKey;
        if (!apiKey) {
          // No API key — simple local add/remove simulation
          await new Promise(r => setTimeout(r, 500));
          typing.remove();
          const botMsg = document.createElement('div');
          botMsg.style.cssText = 'align-self:flex-start;background:var(--bubble-bot);color:inherit;padding:0.4rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;';
          botMsg.textContent = 'عذراً، تعديل القائمة يتطلب اتصالاً بخدمة الذكاء الاصطناعي. يرجى التحقق من مفتاح API.';
          chatLog.appendChild(botMsg);
          chatLog.scrollTop = chatLog.scrollHeight;
          return;
        }

        // Build follow-up prompt with current food data
        const dislikedList = getDislikedFoods();
        const basePrompt = `أنت مستشار تغذية محايد. قام المستخدم بمراجعة خطته الغذائية ويريد تعديلها حسب طلبه.

الخطة الغذائية الحالية (JSON):
${JSON.stringify(currentData, null, 2)}

الأطعمة التي يكرهها أو لا يفضلها المستخدم حالياً ويجب استبعادها تماماً واستبدالها ببدائل مناسبة وصحية:
${dislikedList.length > 0 ? dislikedList.join('، ') : 'لا يوجد'}

طلب المستخدم الحالي: "${text}"

تعليمات:
1. قيّم الطلب بناءً على البيانات المتاحة في الخطة الحالية.
2. إذا عبر المستخدم في طلبه الحالي عن كرهه أو عدم تفضيله أو رغبته في استبدال طعام معين لأنه لا يحبه (مثل "لا أحب كذا" أو "أكره كذا" أو "أزل كذا لأني لا آكله")، فقم بالآتي:
   أ. حدد هذا الطعام المستبعد واستبدله ببديل مناسب في الخطة.
   ب. ضع اسم هذا الطعام المستبعد باللغة العربية في مصفوفة "newDislikedFoods" المذكورة أدناه لتسجيله للمستقبل.
3. إذا كان الطلب إضافة عنصر جديد: ضعه في الـ card المناسبة حسب عنوانها (title).
4. إذا كان الطلب إزالة عنصر: ابحث عنه في جميع الـ cards واحذفه.
5. إذا كان الطلب غير مناسب أو غير صحي بناءً على التحليل الموضوعي للخطة: أرجِع نفس JSON الأصلي بدون تغيير وأضف حقل "refusal" يشرح سبب الرفض موضوعياً.
6. كل عنصر مضاف يحتوي على "name" و "reason" (سبب موضوعي).
7. أخرج JSON صالحاً مطابقاً للهيكل التالي:

{
  "badge": "...",
  "analysis": "...",
  "drugWarnings": [...],
  "cards": [...],
  "newDislikedFoods": ["اسم الطعام المكتشف من طلب المستخدم الحالي إذا ذكر عدم حبه له، وإلا مصفوفة فارغة"],
  "refusal": "سبب الرفض (فقط إذا رفضت الطلب، وإلا فلا تضف هذا الحقل)"
}
`;

        async function callFollowUp(promptText, allKeys) {
          const qwen = 'qwen/qwen3-32b';
          const llama = 'llama-3.3-70b-versatile';
          const pref = STATE.food.preferredModel;
          const primaryKey = allKeys[0];

          const tryModel = async (key, model) => {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
              body: JSON.stringify({
                model,
                temperature: 0.2,
                max_tokens: 3000,
                messages: [
                  { role: 'system', content: 'أنت مستشار تغذية محايد. أخرج JSON صالحاً فقط.' },
                  { role: 'user', content: promptText },
                ],
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const raw = data.choices?.[0]?.message?.content;
              if (!raw) throw new Error('لم يرد Groq بأي محتوى');

              let clean = raw.replace(/```json|```/g, '').trim();
              clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              clean = clean.replace(/<think>/gi, '').trim();
              const jsonStart = clean.indexOf('{');
              const jsonEnd = clean.lastIndexOf('}');
              if (jsonStart !== -1 && jsonEnd !== -1) {
                clean = clean.substring(jsonStart, jsonEnd + 1);
              } else {
                throw new Error('الرد لا يحتوي على JSON صالح');
              }
              const parsed = safeJsonParse(repairJSON(clean));
              if (!parsed.cards || !Array.isArray(parsed.cards)) {
                throw new Error('الاستجابة لا تحتوي على هيكل بطاقات صالح');
              }
              STATE.food.lastModelUsed = model;
              return { ok: true, data: parsed };
            }

            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || 'فشل الاتصال';
            if (res.status === 401) return { ok: false, fatal: true, error: new Error('مفتاح Groq غير صحيح') };
            if (res.status === 429) return { ok: false, fatal: false };
            if (res.status === 503) return { ok: false, fatal: true, error: new Error('خدمة Groq غير متاحة مؤقتاً — حاول بعد قليل') };
            return { ok: false, fatal: true, error: new Error(msg) };
          };

          const primaryModel = pref === 'llama' ? llama : qwen;
          const fallbackModel = pref === 'llama' ? qwen : llama;

          // Phase 1: primary model on all keys
          for (const key of allKeys) {
            const r = await tryModel(key, primaryModel);
            if (r.ok) return r.data;
            if (r.fatal) throw r.error;
          }

          // Phase 2: re-check primary on org1 ↔ fallback on each key
          for (const llmKey of allKeys) {
            const q = await tryModel(primaryKey, primaryModel);
            if (q.ok) return q.data;
            if (q.fatal) throw q.error;
            const f = await tryModel(llmKey, fallbackModel);
            if (f.ok) return f.data;
            if (f.fatal) throw f.error;
          }

          throw new Error('فشلت جميع محاولات الاتصال بالنماذج');
        }

        const followUpKeys = STATE.apiKeys.length > 0 ? STATE.apiKeys : [apiKey];
        const updatedData = await callFollowUp(basePrompt, followUpKeys);

        // Check if the AI refused the request
        if (updatedData.refusal) {
          STATE.food.chatLog.push({ role: 'assistant', text: updatedData.refusal });
          typing.remove();

          const refusalMsg = document.createElement('div');
          refusalMsg.style.cssText = 'align-self:flex-start;background:#fefce8;color:#92400e;padding:0.5rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;border:1px solid #fde68a;';
          refusalMsg.textContent = `⚠️ ${updatedData.refusal}`;
          chatLog.appendChild(refusalMsg);
          chatLog.scrollTop = chatLog.scrollHeight;
          return;
        }

        // Process newly disliked foods returned by AI
        if (updatedData.newDislikedFoods && Array.isArray(updatedData.newDislikedFoods) && updatedData.newDislikedFoods.length > 0) {
          const currentDisliked = getDislikedFoods();
          let changed = false;
          updatedData.newDislikedFoods.forEach(food => {
            const trimmed = food.trim();
            if (trimmed && !currentDisliked.includes(trimmed)) {
              currentDisliked.push(trimmed);
              changed = true;
            }
          });
          if (changed) {
            saveDislikedFoods(currentDisliked);
          }
        }

        // Update state and re-render
        STATE.food.currentData = updatedData;
        STATE.food.chatLog.push({ role: 'assistant', text: 'تم تعديل القائمة بنجاح ✓' });
        typing.remove();

        // Append success message
        const botMsg = document.createElement('div');
        botMsg.style.cssText = 'align-self:flex-start;background:var(--bubble-bot);color:inherit;padding:0.4rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;';
        const modelLabel = STATE.food.lastModelUsed?.includes('qwen') ? '🧠 Qwen' : '🦙 Llama';
        botMsg.textContent = `تم تعديل القائمة ✓ (${modelLabel})`;
        chatLog.appendChild(botMsg);
        chatLog.scrollTop = chatLog.scrollHeight;

        // Update the saved session in-memory
        if (STATE.food.savedSessionId) {
          const idx = STATE.sessions.findIndex(s => s.id === STATE.food.savedSessionId);
          if (idx !== -1) {
            const updatedResult = JSON.stringify({
              badge: updatedData.badge || '',
              analysis: updatedData.analysis || '',
              drugWarnings: updatedData.drugWarnings || [],
              cards: updatedData.cards || [],
              mood: STATE.food.currentMood || '',
              chatLog: STATE.food.chatLog || [],
            });
            STATE.sessions[idx] = { ...STATE.sessions[idx], result: updatedResult, details: updatedData.badge || 'توصيات غذائية' };
          }
        }

        // Re-render food cards with updated data
        renderFoodCards(updatedData, false);

      } catch (e) {
        const typingEl = chatLog.querySelector('div:last-child');
        if (typingEl?.textContent === 'جارٍ تعديل القائمة...') typingEl.remove();

        const errMsg = document.createElement('div');
        errMsg.style.cssText = 'align-self:flex-start;background:var(--red-bg);color:var(--red);padding:0.4rem 0.8rem;border-radius:12px 12px 12px 4px;max-width:85%;font-size:0.85rem;word-break:break-word;';
        errMsg.textContent = `خطأ: ${e.message}`;
        chatLog.appendChild(errMsg);
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    }

    document.getElementById('foodChatSendBtn').addEventListener('click', handleFoodChat);
    document.getElementById('foodChatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleFoodChat();
    });

    document.getElementById('foodSaveBtn').addEventListener('click', async () => {
      if (!STATE.currentUser) {
        document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> سجّل الدخول أولاً';
        setTimeout(() => document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> حفظ في السجل', 2000);
        return;
      }
      await saveFoodSession();
      document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-check"></i> تم الحفظ!';
      setTimeout(() => document.getElementById('foodSaveBtn').innerHTML = '<i class="ti ti-device-floppy"></i> حفظ في السجل', 3000);
    });



    // API key is set in STATE.food.apiKey — no user UI needed

    async function withFallbackKey(fn, apiKey, allKeys, ...args) {
      const keys = [apiKey, ...(allKeys || []).filter(k => k !== apiKey)];
      let lastError;
      for (const key of keys) {
        try {
          return await fn(...args, key);
        } catch (e) {
          if (!e.message?.includes('Rate limit') && !e.message?.includes('rate_limit')) throw e;
          lastError = e;
        }
      }
      throw lastError;
    }

    /* ================================================================
       MEDICAL TEST ANALYZER
       ================================================================ */

    function cleanControlChars(str) {
      let inString = false;
      let escaped = false;
      let result = '';
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (escaped) {
          result += c;
          escaped = false;
          continue;
        }
        if (c === '\\') {
          result += c;
          escaped = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          result += c;
          continue;
        }
        if (inString) {
          const code = c.charCodeAt(0);
          if (code < 32) {
            if (c === '\n') result += '\\n';
            else if (c === '\r') result += '\\r';
            else if (c === '\t') result += '\\t';
            else {
              result += '\\u' + code.toString(16).padStart(4, '0');
            }
            continue;
          }
        }
        result += c;
      }
      return result;
    }

    function safeJsonParse(str) {
      const cleaned = cleanControlChars(str);
      return JSON.parse(cleaned);
    }

    function repairJSON(str) {
      let cleanedStr = cleanControlChars(str);
      try { JSON.parse(cleanedStr); return cleanedStr; } catch (e) {}

      let fixed = cleanedStr
        .replace(/}\s*{/g, '},{')
        .replace(/\]\s*{/g, '],{')
        .replace(/}\s*\[/g, '},[')
        .replace(/,\s*]/g, ']')
        .replace(/,\s*}/g, '}')
        .replace(/\b(NaN|Infinity|-Infinity)\b/g, '"$1"')
        .replace(/:\s*,\s*/g, ':""')
        .replace(/\[\s*,/g, '[')
        .replace(/,\s*\]/g, ']')
        .replace(/([{,])\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
      try { JSON.parse(fixed); return fixed; } catch (e) {}

      fixed = fixed
        .replace(/'/g, '"')
        .replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
      try { JSON.parse(fixed); return fixed; } catch (e) {}

      let depth = 0, validEnd = -1, started = false;
      for (let i = 0; i < fixed.length; i++) {
        if (fixed[i] === '{' || fixed[i] === '[') { depth++; started = true; }
        if (fixed[i] === '}' || fixed[i] === ']') {
          depth--;
          if (started && depth === 0) validEnd = i + 1;
        }
      }
      if (validEnd > 0) {
        for (let end = validEnd; end > 0; end--) {
          try { JSON.parse(fixed.substring(0, end)); return fixed.substring(0, end); } catch (e) {}
        }
      }

      throw new Error('لم يتمكن إصلاح JSON');
    }

    async function extractValuesFromImage(base64Image, apiKey) {
      const extractionPrompt = `أنت نظام OCR لتقارير طبية. اتبع الخطوات بدقة:

الخطوة 1 — المسح: امسح صورة التقرير وحدد الجداول.
الخطوة 2 — التصفية: لكل جدول، قرر إن كان يحتوي على بيانات تحاليل طبية مخبرية أم لا. البيانات الطبية تحتوي على أسماء فحوصات معروفة وقيم رقمية ووحدات قياس (مثل mg/dL، U/L، mmol/L، g/dL، %). إذا كان الجدول لا يحوي بيانات تحاليل طبية مخبرية (مثل جداول مقارنة، مواصفات تقنية، تقييمات)، فتجاهله بالكامل.
الخطوة 3 — الاستخراج: من الجداول الطبية فقط، لكل صف أخرج JSON:
{
  "name": "اسم الاختبار",
  "value": "القيمة الرقمية",
  "unit": "وحدة القياس إن وجدت",
  "normalRange": "النطاق الطبيعي إن وجد"
}
الخطوة 4 — التحقق: عد عناصر المخرجات وتأكد من اكتمالها.

قواعد:
- استخرج كل صف من الجداول الطبية دون استثناء.
- الخلايا الفارغة → استخدم "—".
- لا تستخرج من جداول غير طبية أبداً.
- أخرج JSON array فقط، لا markdown ولا كلمات خارج الهيكل.`;


      const fallbackModels = ['qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-11b-vision-preview', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
      let lastError;
      for (const model of ['meta-llama/llama-4-scout-17b-16e-instruct', ...fallbackModels]) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model, temperature: 0.1, max_tokens: 4000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: extractionPrompt },
                  { type: 'image_url', image_url: { url: base64Image } }
                ]
              }]
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (msg.includes('decommissioned') || msg.includes('deprecated')) {
              lastError = new Error(msg); continue;
            }
            throw new Error(msg || 'فشل استخراج القيم');
          }
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          if (!raw) throw new Error('لم يرد خادم الاستخراج');
          let clean = raw.replace(/```json|```/g, '').trim();
          const startIdx = clean.indexOf('[');
          const endIdx = clean.lastIndexOf(']');
          if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
          STATE.medicalTest.lastModelUsed = model;
          if (clean.indexOf('[') === -1 && clean.indexOf('{') === -1) {
            throw new Error(`النموذج ${model} لم يُرجع JSON صالح`);
          }
          return safeJsonParse(repairJSON(clean));
        } catch (e) { lastError = e; }
      }
      throw lastError || new Error('فشلت جميع محاولات الاستخراج');
    }

    async function analyzeExtractedValues(values, apiKey) {
      const valuesText = values.map((v, i) =>
        `${i + 1}. ${v.name}: ${v.value} ${v.unit || ''} (الطبيعي: ${v.normalRange || '—'})`
      ).join('\n');

      const analysisPrompt = `أنت محلل سريري خبير واستشاري طبي محترف. إليك القيم المستخرجة من تقرير التحاليل الطبية:

${valuesText}

تحقق أولاً بدقة: هل البيانات المستخرجة أعلاه (إن وجدت) أو السياق يمثل فحوصات أو تحاليل طبية بشرية مخبرية حقيقية؟ إذا كانت البيانات فارغة أو لا تتعلق بالفحوصات الطبية البشرية (مثال: مقارنة سيارات، مواصفات هواتف، فواتير، تقييمات تكنولوجية، أو أي موضوع آخر غير طبي)، فيجب عليك إرجاع استجابة JSON تحتوي حصراً على الحقول التالية بالضبط بالقيم المحددة:
{
  "badge": "غير طبي",
  "status": "هذا ليس فحصًا طبيًا",
  "statusClass": "red",
  "analysis": "هذا ليس فحصًا طبيًا",
  "advices": []
}
(تنبيه: لا تضف أي نص آخر أو تفاصيل خارج هيكل JSON في هذه الحالة).

أما إذا كانت فحوصات طبية بشرية، فاتبع الخطوات التالية بدقة متناهية لصياغة التقرير باحترافية:

الخطوة 1 — لكل تحليل أو قيمة في المدخلات، اكتب سطرًا منفصلاً تماماً (باستخدام \n للانتقال للسطر التالي) بالصيغة التالية تماماً لتوضيح المقارنة صراحة وبساطة:
"مستوى [اسم التحليل باللغة العربية والإنجليزية وبجانبه بين قوسين شرح وظيفته الطبية المبسطة باللغة العربية، مثل: الهيموجلوبين (مستوى خلايا الدم الحمراء)] هو [القيمة] [الوحدة] والمدى الطبيعي يتراوح بين [المدى الطبيعي]، لذا فهو [طبيعي / غير طبيعي (مرتفع/أعلى من الطبيعي أو منخفض/أقل من الطبيعي)]."

تنبيهات هامة للمقارنة الدقيقة:
- قارن القيمة بالمدى الطبيعي بدقة متناهية: إذا كان المدى الطبيعي مثلاً هو 4-11، والقيمة هي 11.8 فيعتبر مرتفعاً (أعلى من الحد الطبيعي)، وإذا كانت القيمة هي 2 فيعتبر منخفضاً (أقل من الحد الطبيعي). تأكد من فحص الحدود بدقة ولا تخطئ أبداً في تصنيف النسبة.
- يجب أن تظهر كل قيمة مستخرجة في سطر مستقل ومنفصل.

الخطوة 2 — التبسيط للمريض: قدّم شرحاً مبسطاً بأسلوب مفهوم جداً للشخص العادي الذي ليس لديه خلفية طبية للمفاهيم والمصطلحات الطبية الصعبة الواردة في التحاليل (مثل معنى الهيموجلوبين، الكرياتينين، الدهون الثلاثية، إلخ) ودورها وتأثيرها على الجسم.

الخطوة 3 — التشخيص والتلخيص: لخص النتائج الإجمالية ودلالتها السريرية العامة.

الخطوة 4 — الإخراج: أجب بصيغة JSON صالحة 100% فقط:
{
  "badge": "عنوان قصير لنوع الفحص أو التحليل المكتشف",
  "status": "طبيعي أو غير طبيعي / يحتاج متابعة أو مراجعة طبية عاجلة",
  "statusClass": "green أو orange أو red",
  "analysis": "[نص الخطوة 1]\n\n[نص الخطوة 2]\n\n[نص الخطوة 3]",
  "advices": [{ "title": "عنوان النصيحة", "desc": "شرح النصيحة ومبرراتها الطبية بأسلوب هادئ وواضح" }]
}

هام جداً: كل قيمة من المدخلات يجب أن تظهر في حقل "analysis" في الخطوة 1.`;

      const models = ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'deepseek-r1-distill-llama-70b'];
      let lastError;
      for (const model of models) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              temperature: 0.3,
              max_tokens: 4000,
              messages: [{ role: 'system', content: 'أنت أخصائي تحاليل طبية خبير. أجب بـ JSON فقط.' }, { role: 'user', content: analysisPrompt }]
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (msg.includes('decommissioned') || msg.includes('deprecated')) {
              lastError = new Error(msg); continue;
            }
            throw new Error(msg || 'فشل تحليل القيم');
          }
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          if (!raw) throw new Error('لم يرد خادم التحليل');
          let clean = raw.replace(/```json|```/g, '').trim();
          const startIdx = clean.indexOf('{');
          const endIdx = clean.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
          if (clean.indexOf('{') === -1 && clean.indexOf('[') === -1) {
            throw new Error(`النموذج ${model} لم يُرجع JSON صالح`);
          }
          STATE.medicalTest.lastModelUsed = model;
          return safeJsonParse(repairJSON(clean));
        } catch (e) { lastError = e; }
      }
      throw lastError || new Error('فشلت جميع محاولات التحليل');
    }

    async function getMedicalTestRecsFromAI(base64Image, apiKey) {
      // Step 1: extract raw values from image
      let extracted;
      try {
        extracted = await extractValuesFromImage(base64Image, apiKey);
      } catch (e) {
        console.warn('Extraction failed, falling back to single-pass:', e.message);
      }
      // Step 2: if extraction succeeded, analyze textually; else fall back to one-shot vision
      if (extracted && Array.isArray(extracted) && extracted.length > 0) {
        return await analyzeExtractedValues(extracted, apiKey);
      }
      // Fallback: original single-pass approach
      const promptText = `أنت أخصائي تحاليل طبية خبير واستشاري سريري محترف. يرجى قراءة وتحليل صورة التحليل الطبي المرفقة.

تحقق أولاً بدقة: هل الصورة المرفقة هي فحص طبي أو تقرير طبي بشري؟ إذا كانت الصورة لا تتعلق بالتحاليل أو الفحوصات الطبية البشرية (مثال: مقارنة سيارات، مواصفات هواتف، فواتير، جداول غير طبية، أو أي موضوع آخر غير طبي)، فيجب عليك إرجاع استجابة JSON تحتوي حصراً على الحقول التالية بالضبط بالقيم المحددة:
{
  "badge": "غير طبي",
  "status": "هذا ليس فحصًا طبيًا",
  "statusClass": "red",
  "analysis": "هذا ليس فحصًا طبيًا",
  "advices": []
}
(تنبيه: لا تضف أي نص آخر أو تفاصيل خارج هيكل JSON في هذه الحالة).

أما إذا كانت فحوصات طبية بشرية، فقدم استجابة بصيغة JSON صالحة 100% تحتوي على الحقول التالية بالضبط:
{
  "badge": "عنوان قصير لنوع الفحص أو التحليل المكتشف (مثال: صورة دم كاملة CBC، وظائف كبد، إلخ)",
  "status": "طبيعي أو غير طبيعي / يحتاج متابعة أو مراجعة طبية عاجلة",
  "statusClass": "green (للطبيعي)، orange (للمتوسط/متابعة)، red (للحالات غير الطبيعية/طارئة) - اختر واحدة فقط تطابق الحالة",
  "analysis": "اكتب الشرح بالترتيب التالي:
1. لكل فحص أو قيمة واردة في الصورة، اكتب سطرًا منفصلاً تماماً (باستخدام \\n للانتقال للسطر التالي) يوضح المقارنة:
'مستوى [اسم التحليل باللغة العربية والإنجليزية وبجانبه بين قوسين شرح وظيفته الطبية المبسطة باللغة العربية، مثل: الهيموجلوبين (مستوى خلايا الدم الحمراء)] هو [القيمة] [الوحدة] والمدى الطبيعي يتراوح بين [المدى الطبيعي]، لذا فهو [طبيعي / غير طبيعي (مرتفع/أعلى من الطبيعي أو منخفض/أقل من الطبيعي)].'
تنبيهات هامة للمقارنة الدقيقة:
- قارن القيمة بالمدى الطبيعي بدقة متناهية: إذا كان المدى الطبيعي مثلاً هو 4-11، والقيمة هي 11.8 فيعتبر مرتفعاً (أعلى من الحد الطبيعي)، وإذا كانت القيمة هي 2 فيعتبر منخفضاً (أقل من الحد الطبيعي). تأكد من فحص الحدود بدقة ولا تخطئ في تصنيف النسبة.
2. ثم (في سطر جديد) قدّم شرحاً مبسطاً بأسلوب مفهوم جداً للشخص العادي الذي لا يملك خلفية طبية للمفاهيم والمصطلحات الصعبة الواردة في التحليل وتأثيرها ودورها في الجسم.
3. ثم (في سطر جديد) لخص النتائج الإجمالية ودلالتها السريرية العامة.",
  "advices": [
    {
      "title": "عنوان النصيحة 1",
      "desc": "شرح النصيحة 1 بالتفصيل ومبرراتها الطبية بأسلوب هادئ وواضح"
    }
  ]
}`;
      const fallbackModels = ['qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.2-11b-vision-preview', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
      let lastError;
      for (const model of ['meta-llama/llama-4-scout-17b-16e-instruct', ...fallbackModels]) {
        try {
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model, temperature: 0.1, max_tokens: 3000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: 'أنت أخصائي تحاليل طبية خبير واستشاري سريري. أجب دائماً بـ JSON فقط متطابق مع الهيكل المطلوب دون أي علامات markdown أو نصوص خارج الهيكل.\n\n' + promptText },
                  { type: 'image_url', image_url: { url: base64Image } }
                ]
              }]
            })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err.error?.message || '';
            if (msg.includes('decommissioned') || msg.includes('deprecated')) {
              lastError = new Error(msg); continue;
            }
            throw new Error(msg || 'فشل الاتصال بخدمة التحليل');
          }
          const data = await res.json();
          const raw = data.choices?.[0]?.message?.content;
          if (!raw) throw new Error('لم يرد خادم الذكاء الاصطناعي بأي نتائج');
          let clean = raw.replace(/```json|```/g, '').trim();
          const startIdx = clean.indexOf('{');
          const endIdx = clean.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) clean = clean.substring(startIdx, endIdx + 1);
          if (clean.indexOf('{') === -1 && clean.indexOf('[') === -1) {
            throw new Error(`النموذج ${model} لم يُرجع JSON صالح`);
          }
          STATE.medicalTest.lastModelUsed = model;
          return safeJsonParse(repairJSON(clean));
        } catch (e) { lastError = e; }
      }
      throw lastError || new Error('فشلت جميع المحاولات');
    }

    async function analyzePdfText(pdfText, apiKey) {
      // Step 1: extract structured values from raw PDF text
      const extractionPrompt = `أنت نظام استخراج بيانات من تقارير طبية. اتبع الخطوات بدقة:

الخطوة 1 — المسح: حدد الجداول في النص التالي.
الخطوة 2 — التصفية: لكل جدول، قرر إن كان يحتوي على بيانات تحاليل طبية مخبرية. البيانات الطبية تحتوي على أسماء فحوصات وقيم رقمية ووحدات قياس. إذا كان الجدول غير طبي، فتجاهله بالكامل.
الخطوة 3 — الاستخراج: من الجداول الطبية فقط، لكل صف أخرج JSON:
{
  "name": "اسم الاختبار",
  "value": "القيمة الرقمية",
  "unit": "وحدة القياس إن وجدت",
  "normalRange": "النطاق الطبيعي إن وجد"
}
الخطوة 4 — التحقق: عد عناصر المخرجات وتأكد من اكتمالها.

قواعد:
- استخرج كل صف من الجداول الطبية فقط.
- الخلايا الفارغة → استخدم "—".
- لا تستخرج من جداول غير طبية أبداً.
- أخرج JSON array فقط.

نص التقرير:
${pdfText}`;

      const extractRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: 'أنت نظام استخراج بيانات من تقارير طبية. أخرج JSON array صالحاً فقط.' },
            { role: 'user', content: extractionPrompt }
          ]
        })
      });
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}));
        throw new Error(err.error?.message || 'فشل استخراج القيم من النص');
      }
      const extractData = await extractRes.json();
      const extractRaw = extractData.choices?.[0]?.message?.content;
      if (!extractRaw) throw new Error('لم يرد خادم الاستخراج');
      let extractClean = extractRaw.replace(/```json|```/g, '').trim();
      const arrStart = extractClean.indexOf('[');
      const arrEnd = extractClean.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd !== -1) extractClean = extractClean.substring(arrStart, arrEnd + 1);
      const values = safeJsonParse(repairJSON(extractClean));
      if (!Array.isArray(values)) throw new Error('فشل تنسيق البيانات المستخرجة');

      return await analyzeExtractedValues(values, apiKey);
    }

    async function convertPdfToImage(pdfDataUrl) {
      try {
        const pdfjsLib = window.pdfjsLib;
        if (!pdfjsLib) throw new Error('PDF.js غير محمل');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(pdfDataUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        console.error('PDF conversion error:', err);
        return null;
      }
    }

    const uploadZone = document.getElementById('medicalTestUploadZone');
    const medicalInput = document.getElementById('medicalTestInput');
    const previewContainer = document.getElementById('medicalTestPreviewContainer');
    const previewImg = document.getElementById('medicalTestPreviewImage');
    const clearImageBtn = document.getElementById('medicalTestClearBtn');
    const analyzeBtn = document.getElementById('medicalTestAnalyzeBtn');
    const uploadBtn = document.getElementById('medicalTestUploadBtn');

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => medicalInput.click());
    }

    if (uploadZone) {
      uploadZone.addEventListener('click', () => medicalInput.click());

      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
      });

      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
      });

      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleMedicalImageSelect(e.dataTransfer.files[0]);
        }
      });
    }

    if (medicalInput) {
      medicalInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleMedicalImageSelect(e.target.files[0]);
        }
      });
    }

    if (clearImageBtn) {
      clearImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetMedicalTestImage();
      });
    }

    function handleMedicalImageSelect(file) {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الملف كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.');
        return;
      }

      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

      const reader = new FileReader();
      reader.onload = async () => {
        STATE.medicalTest.selectedImage = reader.result;
        STATE.medicalTest.selectedFileIsPdf = isPdf;
        STATE.medicalTest.selectedFileName = file.name;
        STATE.medicalTest.extractedText = '';

        // If PDF, extract text directly
        if (isPdf) {
          try {
            const pdfjsLib = window.pdfjsLib;
            if (pdfjsLib) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              const pdf = await pdfjsLib.getDocument(reader.result).promise;
              let fullText = '';
              for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                fullText += content.items.map(item => item.str).join(' ') + '\n';
              }
              STATE.medicalTest.extractedText = fullText.trim();
            }
          } catch (err) {
            console.warn('PDF text extraction failed:', err);
          }
        }

        const pdfPreview = document.getElementById('medicalTestPdfPreview');
        const pdfNameEl = document.getElementById('medicalTestPdfName');

        if (isPdf) {
          previewImg.style.display = 'none';
          pdfPreview.style.display = '';
          if (pdfNameEl) pdfNameEl.textContent = file.name;
        } else {
          previewImg.style.display = '';
          pdfPreview.style.display = 'none';
          previewImg.src = reader.result;
        }

        previewContainer.style.display = '';
        uploadZone.style.display = 'none';
        analyzeBtn.disabled = false;
        if (clearImageBtn) clearImageBtn.style.display = 'inline-flex';
        if (uploadBtn) uploadBtn.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    function resetMedicalTestImage() {
      STATE.medicalTest.selectedImage = null;
      STATE.medicalTest.selectedFileIsPdf = false;
      STATE.medicalTest.selectedFileName = '';
      STATE.medicalTest.extractedText = '';
      previewImg.src = '';
      previewImg.style.display = '';
      document.getElementById('medicalTestPdfPreview').style.display = 'none';
      previewContainer.style.display = 'none';
      uploadZone.style.display = '';
      analyzeBtn.disabled = true;
      medicalInput.value = '';
      if (clearImageBtn) clearImageBtn.style.display = 'none';
      if (uploadBtn) uploadBtn.style.display = 'inline-flex';
    }

    const analyzeBtnEl = document.getElementById('medicalTestAnalyzeBtn');
    if (analyzeBtnEl) {
      analyzeBtnEl.addEventListener('click', async () => {
        if (!STATE.medicalTest.selectedImage) {
          alert('يرجى تحميل صورة التحليل أولاً.');
          return;
        }

        const apiKey = STATE.medicalTest.apiKey;
        if (!apiKey) {
          alert('عذراً، لم يتم العثور على مفتاح Groq API لتشغيل التحليل بالذكاء الاصطناعي.');
          return;
        }

        const loadingEl = document.getElementById('medicalTestLoading');
        const resultsEl = document.getElementById('medicalTestResults');
        const uploaderEl = document.getElementById('medicalTestUploader');
        const errorEl = document.getElementById('medicalTestError');
        const errorMsgEl = document.getElementById('medicalTestErrorMsg');

        uploaderEl.style.display = 'none';
        resultsEl.style.display = 'none';
        errorEl.style.display = 'none';
        loadingEl.style.display = '';

        try {
          const fallbackKeys = STATE.medicalKeys.length > 0 ? STATE.medicalKeys : STATE.apiKeys;
          let resultData;
          if (STATE.medicalTest.selectedFileIsPdf && STATE.medicalTest.extractedText) {
            // PDF with extracted text → text-only analysis (no vision)
            resultData = await withFallbackKey(analyzePdfText, apiKey, fallbackKeys, STATE.medicalTest.extractedText);
          } else {
            let imageToSend = STATE.medicalTest.selectedImage;
            if (STATE.medicalTest.selectedFileIsPdf) {
              imageToSend = await convertPdfToImage(imageToSend);
              if (!imageToSend) throw new Error('تعذر تحويل PDF إلى صورة');
            }
            resultData = await withFallbackKey(getMedicalTestRecsFromAI, apiKey, fallbackKeys, imageToSend);
          }

          document.getElementById('medicalTestDetectedName').textContent = resultData.badge || 'غير محدد';

          // Show model badge
          const medModelBadge = document.getElementById('medicalTestModelBadge');
          const medModel = STATE.medicalTest.lastModelUsed || '';
          if (medModel.includes('llama-3.3')) {
            medModelBadge.textContent = '🦙 Llama 3.3 70B';
            medModelBadge.style.display = '';
          } else if (medModel.includes('llama-3.2')) {
            medModelBadge.textContent = '🔬 Llama 3.2 90B Vision';
            medModelBadge.style.display = '';
          } else if (medModel.includes('llama-4-scout')) {
            medModelBadge.textContent = '🦙 Llama 4 Scout Vision';
            medModelBadge.style.display = '';
          } else if (medModel.includes('qwen3.6-27b')) {
            medModelBadge.textContent = '🧠 Qwen 3.6 27B Vision';
            medModelBadge.style.display = '';
          } else {
            medModelBadge.style.display = 'none';
          }

          const statusBadge = document.getElementById('medicalTestStatusBadge');
          statusBadge.textContent = resultData.status || 'مكتمل';
          statusBadge.className = `medical-status-badge ${resultData.statusClass || 'green'}`;

          document.getElementById('medicalTestAnalysisText').innerHTML = (resultData.analysis || 'لا يوجد تحليل مفصل.').replace(/\n/g, '<br>');

          const advicesGrid = document.getElementById('medicalTestAdvicesGrid');
          advicesGrid.innerHTML = (resultData.advices || []).map(adv => `
            <div class="advice-card">
              <div class="advice-card-icon"><i class="ti ti-bulb"></i></div>
              <div class="advice-card-content">
                <h4>${adv.title}</h4>
                <p>${adv.desc}</p>
              </div>
            </div>
          `).join('');

          resultsEl.style.display = '';
          STATE.medicalTest.lastResult = resultData;
          // Auto-save to history if logged in
          const isMedical = resultData.badge !== 'غير طبي' && resultData.analysis !== 'هذا ليس فحصًا طبيًا';
          if (STATE.currentUser && isMedical) {
            saveMedicalTestSession(resultData);
          }
          if (isMedical) {
            document.getElementById('medicalTestSaveBtn').textContent = STATE.currentUser ? '✓ تم الحفظ في السجل' : 'حفظ في السجل';
            document.getElementById('medicalTestSaveBtn').disabled = false;
          } else {
            document.getElementById('medicalTestSaveBtn').textContent = 'غير قابل للحفظ (مستند غير طبي)';
            document.getElementById('medicalTestSaveBtn').disabled = true;
          }
        } catch (error) {
          console.error("Analysis error:", error);
          errorMsgEl.textContent = `فشل تحليل المستند الطبي: ${error.message || 'خطأ غير معروف'}. يرجى التأكد من جودة الصورة والمحاولة مرة أخرى.`;
          errorEl.style.display = '';
          uploaderEl.style.display = '';
        } finally {
          loadingEl.style.display = 'none';
        }
      });
    }

    const resetBtnEl = document.getElementById('medicalTestResetBtn');
    if (resetBtnEl) {
      resetBtnEl.addEventListener('click', () => {
        document.getElementById('medicalTestResults').style.display = 'none';
        document.getElementById('medicalTestError').style.display = 'none';
        resetMedicalTestImage();
        document.getElementById('medicalTestUploader').style.display = '';
      });
    }

    async function saveMedicalTestSession(resultData) {
      if (!STATE.currentUser) return;
      const session = {
        type: 'medical-test',
        result: JSON.stringify({
          badge: resultData.badge || '',
          status: resultData.status || '',
          statusClass: resultData.statusClass || 'green',
          analysis: resultData.analysis || '',
          advices: resultData.advices || [],
        }),
        details: resultData.badge || 'تحليل طبي',
      };
      try {
        const saved = await api('POST', '/api/sessions', session);
        STATE.sessions.unshift(saved);
      } catch (e) {
        STATE.sessions.unshift({
          id: Date.now(),
          ...session,
          createdAt: new Date().toISOString(),
        });
      }
    }

    async function saveFoodSession() {
      if (!STATE.currentUser) return;
      const foodData = STATE.food.currentData;
      if (!foodData) return;
      const session = {
        type: 'nutrition',
        result: JSON.stringify({
          badge: foodData.badge || '',
          analysis: foodData.analysis || '',
          drugWarnings: foodData.drugWarnings || [],
          cards: foodData.cards || [],
          mood: STATE.food.currentMood || '',
          chatLog: STATE.food.chatLog || [],
        }),
        details: foodData.badge || 'توصيات غذائية',
      };
      try {
        const saved = await api('POST', '/api/sessions', session);
        STATE.sessions.unshift(saved);
        STATE.food.savedSessionId = saved.id;
      } catch (e) {
        const fallback = { id: Date.now(), ...session, createdAt: new Date().toISOString() };
        STATE.sessions.unshift(fallback);
        STATE.food.savedSessionId = fallback.id;
      }
    }

    document.getElementById('medicalTestSaveBtn').addEventListener('click', async () => {
      const resultData = STATE.medicalTest.lastResult;
      if (!resultData) return;
      if (resultData.badge === 'غير طبي' || resultData.analysis === 'هذا ليس فحصًا طبيًا') {
        alert('لا يمكن حفظ المستندات غير الطبية.');
        return;
      }
      if (!STATE.currentUser) {
        document.getElementById('medicalTestSaveBtn').textContent = 'سجّل الدخول أولاً';
        setTimeout(() => document.getElementById('medicalTestSaveBtn').textContent = 'حفظ في السجل', 2000);
        return;
      }
      await saveMedicalTestSession(resultData);
      document.getElementById('medicalTestSaveBtn').textContent = '✓ تم الحفظ!';
      setTimeout(() => document.getElementById('medicalTestSaveBtn').textContent = 'حفظ في السجل', 3000);
    });

    document.getElementById('medicalTestPdfBtn').addEventListener('click', () => {
      const resultData = STATE.medicalTest.lastResult;
      if (!resultData) return;
      const date = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const statusColor = resultData.statusClass === 'red' ? '#d32f2f' : resultData.statusClass === 'orange' ? '#f57c00' : '#388e3c';
      const advicesHtml = (resultData.advices || []).map(a =>
        `<div style="margin-bottom:1rem;padding:0.75rem 1rem;background:#f5f5f5;border-radius:8px;border-right:4px solid #1a73e8;">
          <h4 style="margin:0 0 0.25rem;font-size:0.925rem;color:#1a73e8;">${a.title}</h4>
          <p style="margin:0;font-size:0.85rem;color:#555;">${a.desc}</p>
        </div>`
      ).join('');

      const printWin = window.open('', '_blank', 'width=800,height=600');
      printWin.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طبيبك - تقرير تحليل طبي</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">
      ${resultData.badge ? `<meta name="title" content="${resultData.badge.replace(/[<>]/g, '')}">` : ''}
      <style>
        @page { margin: 1.5cm; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', sans-serif; direction: rtl; color: #333; line-height: 1.8; padding: 2rem; }
        .header { text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .header h1 { color: #1a73e8; font-size: 1.5rem; }
        .header p { color: #666; font-size: 0.875rem; margin-top: 0.5rem; }
        .badge { display: inline-block; padding: 0.25rem 1rem; border-radius: 20px; font-size: 0.875rem; font-weight: 700; color: #fff; }
        h2 { font-size: 1.25rem; margin-top: 0.75rem; }
        .analysis { margin: 1.5rem 0; line-height: 1.8; font-size: 0.925rem; white-space: pre-wrap; }
        .advices { margin-top: 1.5rem; }
        .advices h3 { font-size: 1rem; margin-bottom: 0.75rem; }
        .footer { border-top: 1px solid #ddd; margin-top: 2rem; padding-top: 1rem; font-size: 0.75rem; color: #999; text-align: center; }
      </style></head><body>
        <div class="header">
          <h1>طبيبك — تقرير تحليل طبي</h1>
          <p>${date}</p>
        </div>
        <div style="margin-bottom:1.5rem;">
          <span class="badge" style="background:${statusColor};">${resultData.status || '—'}</span>
          <h2>${resultData.badge || '—'}</h2>
        </div>
        <div class="analysis">${resultData.analysis || ''}</div>
        ${advicesHtml ? `<div class="advices"><h3>نصائح وإرشادات طبية:</h3>${advicesHtml}</div>` : ''}
        <div class="footer">تم الإنشاء بواسطة طبيبك — الذكاء الاصطناعي للرعاية الصحية. هذه المعلومات ليست تشخيصاً طبياً بديلاً عن استشارة الطبيب.</div>
        <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };<\/script>
      </body></html>`);
      printWin.document.close();
    });

    /* ================================================================
       AUTH
       ================================================================ */
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

    /* ================================================================
       NOTIFICATION PERMISSION MODAL
       ================================================================ */
    function showNotificationModal() {
      document.getElementById('notificationModal').classList.add('open');
    }

    document.getElementById('notificationEnableBtn').addEventListener('click', requestNotifPermission);

    document.getElementById('notificationModalClose').addEventListener('click', () => {
      document.getElementById('notificationModal').classList.remove('open');
      refreshProfileScreen();
      showTab('profile');
    });

    document.getElementById('notificationModal').addEventListener('click', e => {
      if (e.target === document.getElementById('notificationModal')) {
        document.getElementById('notificationModal').classList.remove('open');
        refreshProfileScreen();
        showTab('profile');
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
      STATE.currentUser = null;
      clearToken();
      STATE.sessions = [];
      STATE.meds.list = [];
      STATE.meds.taken = {};
      refreshProfileScreen();
      refreshHistoryScreen();
    });

    document.getElementById('editProfileBtn').addEventListener('click', () => {
      const u = STATE.currentUser;
      if (!u) return;
      document.getElementById('editName').value = u.name || '';
      document.getElementById('editAge').value = u.age || '';
      document.getElementById('editGender').value = u.gender || '';
      document.getElementById('editMobile').value = u.mobile || '';
      document.getElementById('editHistory').value = u.history || '';
      document.getElementById('editProfileForm').style.display = '';
    });

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      document.getElementById('editProfileForm').style.display = 'none';
    });

    document.getElementById('editProfileForm').addEventListener('submit', async e => {
      e.preventDefault();
      const u = STATE.currentUser;
      const nameVal = document.getElementById('editName').value.trim();
      const ageVal = document.getElementById('editAge').value;
      const genderVal = document.getElementById('editGender').value;
      const mobileVal = document.getElementById('editMobile').value.trim();
      const historyVal = document.getElementById('editHistory').value.trim();

      if (!nameVal || !ageVal || !genderVal || !mobileVal) {
        alert('يرجى ملء جميع الحقول المطلوبة.');
        return;
      }
      const ageNum = parseInt(ageVal, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) { alert('يرجى إدخال عمر صحيح يتراوح بين 1 و120 عاماً.'); return; }
      const mobileRegex = /^\+?[0-9]{10,15}$/;
      if (!mobileRegex.test(mobileVal)) {
        alert('يرجى إدخال رقم هاتف محمول صحيح (يتكون من 10 إلى 15 رقماً).');
        return;
      }

      try {
        await api('PUT', '/api/auth/profile', { name: nameVal, age: ageVal, gender: genderVal, mobile: mobileVal, history: historyVal, timezoneOffset: -new Date().getTimezoneOffset() / 60 });
        STATE.currentUser = await api('GET', '/api/auth/profile');
        document.getElementById('editProfileForm').style.display = 'none';
        refreshProfileScreen();
      } catch (err) {
        alert('فشل تحديث الملف الشخصي.');
      }
    });

    async function refreshProfileScreen() {
      const loggedIn = !!STATE.currentUser;
      document.getElementById('authContainer').style.display = loggedIn ? 'none' : '';
      document.getElementById('profileContainer').style.display = loggedIn ? '' : 'none';
      if (loggedIn) {
        const u = STATE.currentUser;
        document.getElementById('profileName').textContent = u.name || '';
        document.getElementById('profileUsername').textContent = u.username ? '@' + u.username : '';
        document.getElementById('profileAge').textContent = u.age || '';
        document.getElementById('profileGender').textContent = u.gender || '';
        document.getElementById('profileMobile').textContent = u.mobile || 'Not set';
        document.getElementById('profileHistory').textContent = u.history || 'No medical background declared.';
        if (u.avatar) {
          document.getElementById('profileAvatar').src = u.avatar;
          document.getElementById('profileAvatar').style.display = '';
          document.getElementById('avatarPlaceholder').style.display = 'none';
        } else {
          document.getElementById('profileAvatar').style.display = 'none';
          document.getElementById('avatarPlaceholder').style.display = '';
        }

        // Mentor section
        const mentorSection = document.getElementById('profileMentorSection');
        mentorSection.style.display = '';
        const mentorsList = document.getElementById('profileMentorsList');
        if (STATE.mentors.length === 0) {
          mentorsList.innerHTML = '<p style="color:var(--text-2);font-size:0.8rem;">لم تقم بإضافة أي مشرف بعد.</p>';
        } else {
          mentorsList.innerHTML = STATE.mentors.map(m => `
            <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.6rem;">
              <i class="ti ti-user-check" style="color:var(--primary);"></i>
              <span style="flex:1;font-size:0.85rem;">${m.name} <span style="color:var(--text-2);font-size:0.75rem;">@${m.mentorUsername}</span></span>
              <button class="profile-mentor-remove" data-user="${m.mentorUsername}" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.9rem;"><i class="ti ti-trash"></i></button>
            </div>
          `).join('');
          mentorsList.querySelectorAll('.profile-mentor-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
              if (!confirm('إزالة هذا المرشد؟')) return;
              try {
                await api('DELETE', `/api/mentors/${btn.dataset.user}`);
                await loadMentorData();
                refreshProfileScreen();
              } catch (e) { alert(e.message); }
            });
          });
        }
        const menteesWrap = document.getElementById('profileMenteesBtnWrap');
        menteesWrap.style.display = STATE.mentees.length > 0 ? '' : 'none';

        // Wire up add mentor button (re-bind on each refresh)
        document.getElementById('profileAddMentorBtn').onclick = async () => {
          const username = prompt('أدخل اسم المستخدم للمرشد:');
          if (!username) return;
          try {
            await api('POST', '/api/mentors', { mentorUsername: username.trim() });
            await loadMentorData();
            refreshProfileScreen();
          } catch (e) { alert(e.message); }
        };
        // Wire up mentees button
        document.getElementById('profileMenteesBtn').onclick = () => showTab('mentor');

        // Load mentor messages
        const msgWrap = document.getElementById('profileMentorMessagesWrap');
        const msgDiv = document.getElementById('profileMentorMessages');
        const replyWrap = document.getElementById('profileMentorReplyWrap');
        if (STATE.mentors.length > 0) {
          let msgs = [];
          try {
            msgs = await api('GET', '/api/mentors/messages');
            if (msgs && msgs.length > 0) {
              msgWrap.style.display = '';
              msgDiv.innerHTML = msgs.slice(0, 10).map(m => `
                <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:0.4rem 0.6rem;font-size:0.8rem;">
                  <strong style="color:var(--primary);font-size:0.75rem;">${m.mentorName}</strong>
                  <p style="margin:0.2rem 0;word-break:break-word;">${m.message}</p>
                  <span style="color:var(--text-2);font-size:0.65rem;">${new Date(m.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              `).join('');
            } else {
              msgDiv.innerHTML = '<p style="color:var(--text-2);font-size:0.8rem;">لا توجد رسائل بعد.</p>';
            }
            replyWrap.style.display = '';
          } catch (e) { msgWrap.style.display = 'none'; replyWrap.style.display = 'none'; }

          // Populate mentor reply dropdown
          const sel = document.getElementById('profileMentorReplySelect');
          sel.innerHTML = STATE.mentors.map(m =>
            `<option value="${m.mentorUsername}">${m.name} (@${m.mentorUsername})</option>`
          ).join('');

          // Pre-select the most recent sender
          if (msgs && msgs.length > 0) {
            sel.value = msgs[0].mentorUsername;
          }

          // Wire up send
          document.getElementById('profileMentorReplySend').onclick = async () => {
            const input = document.getElementById('profileMentorReplyInput');
            const msg = input.value.trim();
            if (!msg) return;
            const mentorUser = document.getElementById('profileMentorReplySelect').value;
            input.value = '';
            try {
              await api('POST', '/api/mentors/reply', { mentorUsername: mentorUser, message: msg });
              refreshProfileScreen();
            } catch (e) { alert(e.message); }
          };
          document.getElementById('profileMentorReplyInput').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('profileMentorReplySend').click();
          };
        } else {
          msgWrap.style.display = 'none';
          replyWrap.style.display = 'none';
        }
      }
    }

    /* ------ Profile photo upload ------ */
    document.getElementById('avatarWrap').addEventListener('click', () => {
      document.getElementById('avatarInput').click();
    });
    document.getElementById('avatarInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('الحد الأقصى لحجم الصورة 2 ميجابايت'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api('PUT', '/api/auth/avatar', { avatar: reader.result });
          STATE.currentUser = await api('GET', '/api/auth/profile');
          refreshProfileScreen();
        } catch (err) {
          alert('فشل رفع الصورة');
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    /* ================================================================
       HISTORY
       ================================================================ */
    document.getElementById('historyAuthBtn').addEventListener('click', () => showTab('profile'));
    document.getElementById('historyStartBtn').addEventListener('click', () => showTab('landing'));

    function parseSession(s) {
      if (s.result && typeof s.result === 'string') {
        try {
          const r = JSON.parse(s.result);
          if (s.type === 'medical-test') {
            return { ...s, date: s.createdAt, badge: r.badge, status: r.status, statusClass: r.statusClass, analysis: r.analysis, advices: r.advices, username: s.username || STATE.currentUser?.username };
          }
          if (s.type === 'nutrition') {
            return { ...s, date: s.createdAt, badge: r.badge, analysis: r.analysis, drugWarnings: r.drugWarnings, cards: r.cards, foodMood: r.mood, foodChatLog: r.chatLog, username: s.username || STATE.currentUser?.username };
          }
          return { ...s, date: s.createdAt, ...r, username: s.username || STATE.currentUser?.username };
        } catch (e) { return s; }
      }
      return s;
    }

    let historyActiveFilter = 'all';

    function refreshHistoryScreen() {
      const loggedIn = !!STATE.currentUser;
      document.getElementById('historyLoggedOut').style.display = loggedIn ? 'none' : '';
      document.getElementById('historyLoggedIn').style.display = loggedIn ? '' : 'none';
      if (!loggedIn) return;

      const allSessions = STATE.sessions.map(parseSession);
      const mySessions = historyActiveFilter === 'all' ? allSessions : allSessions.filter(s => s.type === historyActiveFilter);

      // Update filter counts
      const counts = { all: allSessions.length, triage: 0, 'medical-test': 0, nutrition: 0 };
      allSessions.forEach(s => { if (counts[s.type] !== undefined) counts[s.type]++; });
      document.querySelectorAll('#historyFilterBar button').forEach(btn => {
        const f = btn.dataset.filter;
        const count = counts[f] || 0;
        btn.textContent = f === 'all' ? `الكل (${count})` : f === 'triage' ? `فحص طبي (${count})` : f === 'medical-test' ? `تحاليل (${count})` : f === 'nutrition' ? `تغذية (${count})` : btn.dataset.filter;
        btn.classList.toggle('active', f === historyActiveFilter);
      });

      const list = document.getElementById('historyList');
      const empty = document.getElementById('historyEmpty');

      if (mySessions.length === 0) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
      }

      empty.style.display = 'none';
      list.innerHTML = mySessions.map((s, i) => {
        const realIdx = allSessions.indexOf(s);
        const date = new Date(s.date || s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        let level = 'green';
        if (s.type === 'medical-test') level = s.statusClass || 'green';
        else if (s.type === 'nutrition') level = 'green';
        else level = s.level || 'green';

        let title = s.details || 'تقييم';
        if (s.type === 'medical-test') title = s.badge || s.details || 'تحليل طبي';
        else if (s.type === 'nutrition') title = s.badge || s.details || 'توصيات غذائية';
        else title = s.condition || s.details || 'Assessment';

        let meta = '';
        if (s.type === 'medical-test') meta = s.status || 'مكتمل';
        else if (s.type === 'nutrition') meta = 'تغذية';
        else meta = `${date} · <span style="text-transform:capitalize;">${level}</span>`;

        let icon = '';
        if (s.type === 'medical-test') icon = '<i class="ti ti-report-medical" style="color:var(--primary);font-size:1.1rem;"></i>';
        else if (s.type === 'nutrition') icon = '<i class="ti ti-salad" style="color:var(--primary);font-size:1.1rem;"></i>';

        let preview = '';
        if (s.type === 'medical-test') preview = s.analysis ? s.analysis.substring(0, 80) + '...' : '';
        else if (s.type === 'nutrition') preview = s.analysis ? s.analysis.substring(0, 80) + '...' : (s.foodMood || '');
        else preview = s.symptom || s.details || '';

        return `
        <div class="history-card ${level}" data-index="${realIdx}">
          <div class="hc-info">
            <span class="hc-title">${icon} ${title}</span>
            <span class="hc-meta">${date} · ${meta}</span>
            <span class="hc-symptom">${preview}</span>
          </div>
          <div class="hc-actions">
            <button class="icon-btn view-btn" data-index="${realIdx}" title="عرض الجلسة">
              <svg style="width:16px;height:16px;"><use href="#icon-eye"/></svg>
            </button>
            <button class="icon-btn del-btn" data-index="${realIdx}" title="حذف الجلسة">
              <svg style="width:16px;height:16px;"><use href="#icon-trash"/></svg>
            </button>
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openHistoryModal(parseInt(btn.dataset.index)); });
      });
      list.querySelectorAll('.del-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (confirm('هل تريد حذف هذه الجلسة؟')) deleteSession(parseInt(btn.dataset.index));
        });
      });
      list.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', () => openHistoryModal(parseInt(card.dataset.index)));
      });
    }

    // Filter bar handlers
    document.querySelectorAll('#historyFilterBar button').forEach(btn => {
      btn.addEventListener('click', () => {
        historyActiveFilter = btn.dataset.filter;
        refreshHistoryScreen();
      });
    });

    async function deleteSession(localIdx) {
      const mySessions = STATE.sessions.map(parseSession);
      const s = mySessions[localIdx];
      if (!s) return;
      if (s.id && STATE.currentUser) {
        try { await api('DELETE', '/api/sessions/' + s.id); } catch (e) { }
      }
      STATE.sessions = STATE.sessions.filter(ses => ses.id !== s.id);
      refreshHistoryScreen();
    }

    function openHistoryModal(localIdx) {
      const mySessions = STATE.sessions.map(parseSession);
      const s = mySessions[localIdx];
      STATE.modalSessionIndex = localIdx;

      // Hide nutrition-specific sections by default
      document.getElementById('modalFoodSection').style.display = 'none';
      document.getElementById('modalPdfBtn').style.display = 'none';

      if (s.type === 'medical-test') {
        const level = s.statusClass || 'green';
        const date = new Date(s.date || s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

        const badge = document.getElementById('modalUrgency');
        badge.innerHTML = level === 'red' ? '<i class="ti ti-alert-triangle"></i> ' + (s.status || 'غير طبيعي') : level === 'orange' ? '<i class="ti ti-alert-triangle"></i> ' + (s.status || 'متابعة') : '<i class="ti ti-circle-check"></i> ' + (s.status || 'طبيعي');
        badge.style.background = level === 'red' ? 'var(--red)' : level === 'orange' ? 'var(--orange)' : 'var(--green)';
        badge.style.color = '#fff';

        document.getElementById('modalTitle').textContent = s.badge || s.details || 'تحليل طبي';
        document.getElementById('modalMeta').textContent = `محفوظ في ${date}`;
        document.getElementById('modalSymptom').parentElement.style.display = 'none';
        document.getElementById('modalTranscript').parentElement.style.display = 'none';
        document.getElementById('modalDesc').parentElement.querySelector('h4').innerHTML = '<i class="ti ti-notes"></i> الشرح والتحليل';
        document.getElementById('modalDesc').textContent = s.analysis || '';
        document.getElementById('modalDesc').style.whiteSpace = 'pre-wrap';

        const recs = s.advices || [];
        document.getElementById('modalRecs').innerHTML = recs.map(a =>
          `<li><strong>${a.title}</strong>${a.desc ? ': ' + a.desc : ''}</li>`
        ).join('');
        document.getElementById('historyModal').classList.add('open');
        return;
      }

      if (s.type === 'nutrition') {
        const date = new Date(s.date || s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

        const badge = document.getElementById('modalUrgency');
        badge.innerHTML = '<i class="ti ti-salad"></i> تغذية';
        badge.style.background = 'var(--primary)';
        badge.style.color = '#fff';

        document.getElementById('modalTitle').textContent = s.badge || s.details || 'توصيات غذائية';
        document.getElementById('modalMeta').textContent = `محفوظ في ${date}` + (s.foodMood ? ` · الحالة: ${s.foodMood}` : '');
        document.getElementById('modalSymptom').parentElement.style.display = 'none';
        document.getElementById('modalTranscript').parentElement.style.display = 'none';
        document.getElementById('modalDesc').parentElement.querySelector('h4').innerHTML = '<i class="ti ti-notes"></i> التحليل السريري';
        document.getElementById('modalDesc').textContent = s.analysis || '';
        document.getElementById('modalDesc').style.whiteSpace = 'pre-wrap';

        const recs = [];
        document.getElementById('modalRecs').innerHTML = '';

        // Render food cards in modal
        const cards = s.cards || [];
        document.getElementById('modalFoodCards').innerHTML = cards.map(card => {
          let iconHtml = card.icon || '';
          if (iconHtml && !iconHtml.includes('<')) iconHtml = `<span>${card.icon}</span>`;
          const items = (card.items || []).map(item => {
            const name = typeof item === 'object' ? item.name : item;
            const reason = typeof item === 'object' ? item.reason : '';
            return `<li><strong>${name}</strong>${reason ? `<br><small style="color:var(--text-2);">${reason}</small>` : ''}</li>`;
          }).join('');
          return `<div style="margin-bottom:1rem;padding:0.75rem;background:var(--bg-surface);border-radius:12px;border:1px solid var(--border);">
            <div style="font-weight:600;margin-bottom:0.5rem;">${iconHtml} ${card.title}</div>
            <ul style="margin:0;padding-right:1.25rem;list-style:disc;">${items}</ul>
          </div>`;
        }).join('');
        document.getElementById('modalFoodSection').style.display = '';

        // Show chat transcript if there were modifications
        const foodChat = s.foodChatLog || [];
        if (foodChat.length > 0) {
          document.getElementById('modalTranscript').parentElement.style.display = '';
          document.getElementById('modalTranscript').innerHTML = foodChat.map(m =>
            `<div class="msg ${m.role === 'user' ? 'msg-user' : 'msg-bot'}">${m.text}</div>`
          ).join('');
        } else {
          document.getElementById('modalTranscript').parentElement.style.display = 'none';
        }

        document.getElementById('modalPdfBtn').style.display = '';
        document.getElementById('historyModal').classList.add('open');
        return;
      }

      const level = s.level || 'green';
      const date = new Date(s.date || s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      const badge = document.getElementById('modalUrgency');
      badge.innerHTML = level === 'red' ? '<i class="ti ti-urgent" style="color:var(--white)"></i> طارئ' : level === 'orange' ? '<i class="ti ti-alert-triangle" style="color:var(--white)"></i> معتدل' : '<i class="ti ti-circle-check" style="color:var(--white)"></i> خفيف';
      badge.style.background = level === 'red' ? 'var(--red)' : level === 'orange' ? 'var(--orange)' : 'var(--green)';
      badge.style.color = '#fff';

      document.getElementById('modalSymptom').parentElement.style.display = '';
      document.getElementById('modalTranscript').parentElement.style.display = '';
      document.getElementById('modalDesc').parentElement.querySelector('h4').innerHTML = '<i class="ti ti-clipboard"></i> تشخيص الفحص والتحليل السريري';
      document.getElementById('modalDesc').style.whiteSpace = '';

      document.getElementById('modalTitle').textContent = s.condition || 'Assessment';
      document.getElementById('modalMeta').textContent = `Saved on ${date}`;
      document.getElementById('modalSymptom').textContent = s.symptom || '';
      document.getElementById('modalDesc').textContent = s.desc || '';

      const chatLog = s.chatLog || [];
      document.getElementById('modalTranscript').innerHTML = chatLog.map(m =>
        `<div class="msg ${m.role === 'bot' ? 'msg-bot' : 'msg-user'}">${m.text}</div>`
      ).join('');

      const recs = s.recs || [];
      document.getElementById('modalRecs').innerHTML = recs.map(r => `<li>${r}</li>`).join('');
      document.getElementById('historyModal').classList.add('open');
    }

    document.getElementById('closeModal').addEventListener('click', () => {
      document.getElementById('historyModal').classList.remove('open');
    });

    document.getElementById('historyModal').addEventListener('click', e => {
      if (e.target === document.getElementById('historyModal'))
        document.getElementById('historyModal').classList.remove('open');
    });

    document.getElementById('modalDeleteBtn').addEventListener('click', () => {
      if (confirm('هل تريد حذف هذه الجلسة؟')) {
        deleteSession(STATE.modalSessionIndex);
        document.getElementById('historyModal').classList.remove('open');
      }
    });

    document.getElementById('modalCopyBtn').addEventListener('click', () => {
      const mySessions = STATE.sessions.map(parseSession);
      const s = mySessions[STATE.modalSessionIndex];
      if (!s) return;
      let text;
      if (s.type === 'medical-test') {
        const date = new Date(s.date || s.createdAt).toLocaleString('ar-EG');
        text = `=== طبيبك — تقرير تحليل طبي ===\n\nنوع التحليل: ${s.badge || '—'}\nالحالة: ${s.status || '—'}\nالتاريخ: ${date}\n\nالتحليل:\n${s.analysis || ''}\n\nالتوصيات:\n${(s.advices || []).map((a, i) => `${i + 1}. ${a.title}${a.desc ? ': ' + a.desc : ''}`).join('\n')}\n\n⚠️ تم الإنشاء بواسطة الذكاء الاصطناعي — ليس تشخيصاً طبياً.`;
      } else if (s.type === 'nutrition') {
        const date = new Date(s.date || s.createdAt).toLocaleString('ar-EG');
        const cardsText = (s.cards || []).map(card => {
          const items = (card.items || []).map(item => {
            const name = typeof item === 'object' ? item.name : item;
            const reason = typeof item === 'object' ? item.reason : '';
            return `  - ${name}${reason ? ': ' + reason : ''}`;
          }).join('\n');
          return `${card.title}:\n${items}`;
        }).join('\n\n');
        text = `=== طبيبك — تقرير التوجيه الغذائي ===\n\nالخطة: ${s.badge || '—'}\nالتاريخ: ${date}\n\nالتحليل السريري:\n${s.analysis || ''}\n\nالتوصيات الغذائية:\n${cardsText}\n\n⚠️ تم الإنشاء بواسطة الذكاء الاصطناعي — ليس تشخيصاً طبياً.`;
      } else {
        const level = s.level || 'green';
        text = `=== TABIBAK TRIAGE REPORT ===\n\nSymptom: ${s.symptom || ''}\nUrgency: ${level.toUpperCase()}\nCondition: ${s.condition || 'Assessment'}\n\nAssessment:\n${s.desc || ''}\n\nRecommendations:\n${(s.recs || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nGenerated: ${new Date(s.date || s.createdAt).toLocaleString()}\n\n⚠️ AI-generated — not a clinical diagnosis.`;
      }
      navigator.clipboard.writeText(text).catch(() => { });
      document.getElementById('modalCopyBtn').textContent = '✓ تم النسخ!';
      setTimeout(() => document.getElementById('modalCopyBtn').textContent = 'نسخ التقرير', 2000);
    });

    document.getElementById('modalPdfBtn').addEventListener('click', () => {
      const mySessions = STATE.sessions.map(parseSession);
      const s = mySessions[STATE.modalSessionIndex];
      if (!s || s.type !== 'nutrition') return;
      const date = new Date(s.date || s.createdAt).toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
      const time = new Date(s.date || s.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      const cardsHtml = (s.cards || []).map(card => {
        const items = (card.items || []).map(item => {
          const name = typeof item === 'object' ? item.name : item;
          const reason = typeof item === 'object' ? item.reason : '';
          return `<li><strong>${name}</strong>${reason ? `<br><small>${reason}</small>` : ''}</li>`;
        }).join('');
        return `<div style="margin-bottom:1.5rem;page-break-inside:avoid;">
          <h3 style="color:#2b6cb0;margin-bottom:0.5rem;font-size:1.1rem;">${card.icon || ''} ${card.title}</h3>
          <ul style="margin:0;padding-right:1.5rem;">${items}</ul>
        </div>`;
      }).join('');

      const chatHtml = (s.foodChatLog || []).map(m =>
        `<p style="margin:0.3rem 0;padding:0.3rem 0.6rem;background:${m.role === 'user' ? '#e8f0fe' : '#f5f5f5'};border-radius:6px;"><strong>${m.role === 'user' ? 'المستخدم' : 'المساعد'}:</strong> ${m.text}</p>`
      ).join('');

      const win = window.open('', '_blank');
      win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير التوجيه الغذائي</title>
        <style>
          @page { margin: 1.5cm; }
          body { font-family: 'Cairo', Arial, sans-serif; color: #1a1a2e; line-height: 1.7; max-width: 700px; margin: auto; padding: 20px; }
          h1 { color: #2b6cb0; border-bottom: 2px solid #2b6cb0; padding-bottom: 8px; font-size: 22px; }
          h2 { color: #1e4e8c; font-size: 16px; margin-top: 1rem; }
          .meta { color: #666; font-size: 13px; margin-bottom: 1.5rem; }
          .analysis { background: #f0f7ff; padding: 12px; border-radius: 8px; margin-bottom: 1.5rem; }
          .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }
          ul { margin: 0.3rem 0; padding-right: 1.5rem; }
          li { margin-bottom: 0.4rem; }
          small { color: #666; font-size: 12px; }
        </style></head><body>
        <h1>🍽️ تقرير التوجيه الغذائي</h1>
        <div class="meta">
          <p>التاريخ: ${date} ${time}</p>
          ${s.username ? `<p>المريض: ${s.username}</p>` : ''}
          ${s.badge ? `<p>الخطة: ${s.badge}</p>` : ''}
        </div>
        ${s.analysis ? `<div class="analysis"><strong>التحليل السريري:</strong><br>${s.analysis}</div>` : ''}
        <h2>التوصيات الغذائية</h2>
        ${cardsHtml}
        ${chatHtml ? `<h2 style="margin-top:1.5rem;">💬 سجل التعديلات</h2>${chatHtml}` : ''}
        <div class="footer">تم الإنشاء بواسطة طبيبك — الذكاء الاصطناعي المساعد للرعاية الصحية<br>هذا التقرير ليس تشخيصاً طبياً بديلاً عن استشارة الطبيب المختص.</div>
        <script>window.print();window.close();<\/script>
      </body></html>`);
      win.document.close();
    });

    /* ================================================================
       PHARMACIST MODULE
       Two modes:
         1. Quick ask  — opens WhatsApp with a greeting
         2. With report — includes last diagnosis + history + meds
       ================================================================ */

    const PHARMACY_PHONE_DEFAULT = '201009537600';

    function buildWaUrl(phone, message) {
      let clean = phone.replace(/[\s\-\+\(\)]/g, '');
      if (clean.startsWith('00')) {
        clean = clean.slice(2);
      }
      if (clean.startsWith('01') && clean.length === 11) {
        clean = '20' + clean.slice(1);
      } else if (clean.startsWith('05') && clean.length === 10) {
        clean = '966' + clean.slice(1);
      } else if (clean.startsWith('0') && !clean.startsWith('00')) {
        let countryCode = '20';
        if (STATE.currentUser && STATE.currentUser.mobile) {
          const userMobile = STATE.currentUser.mobile.replace(/[\s\-\+\(\)]/g, '');
          if (userMobile.startsWith('966')) countryCode = '966';
          else if (userMobile.startsWith('20')) countryCode = '20';
        }
        clean = countryCode + clean.slice(1);
      }
      return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
    }

    function buildPharmReport() {
      const u = STATE.currentUser;
      let msg = '🏥 *طبيبك — تقرير طبي للصيدلي*\n';
      msg += '━━━━━━━━━━━━━━━━━━━━\n\n';
      if (u) {
        msg += `👤 *المريض:* ${u.name || 'غير محدد'}\n`;
        msg += `🎂 *العمر:* ${u.age || '—'} | *الجنس:* ${u.gender || '—'}\n`;
        if (u.mobile) msg += `📱 *الجوال:* ${u.mobile}\n`;
        if (u.history) msg += `📋 *التاريخ المرضي:* ${u.history}\n`;
        msg += '\n';
      }
      
      // Get the last triage session
      let lastSession = null;
      if (STATE.triageSession && STATE.triageSession.result) {
        lastSession = {
          date: new Date().toISOString(),
          symptom: STATE.triageSession.symptom,
          condition: STATE.triageSession.result.condition,
          desc: STATE.triageSession.result.desc,
          recs: STATE.triageSession.result.recs
        };
      } else {
        const sessions = STATE.sessions || [];
        const triageSessions = sessions.filter(s => s.type === 'triage');
        if (triageSessions.length > 0) {
          lastSession = parseSession(triageSessions[0]);
        }
      }

      if (lastSession) {
        const d = new Date(lastSession.date || lastSession.createdAt)
          .toLocaleDateString('ar-EG', { day: '2-digit', month: 'long', year: 'numeric' });
        msg += `🩺 *آخر تشخيص (${d}):*\n`;
        msg += `   الحالة: ${lastSession.condition || '—'}\n`;
        msg += `   الأعراض: ${lastSession.symptom || '—'}\n`;
        if (lastSession.desc) msg += `   التحليل: ${lastSession.desc}\n`;
        if (lastSession.recs && lastSession.recs.length) {
          msg += `\n✦ *التوصيات السابقة:*\n`;
          lastSession.recs.forEach((r, i) => { msg += `   ${i + 1}. ${r}\n`; });
        }
        msg += '\n';
      }
      if (STATE.meds.list && STATE.meds.list.length > 0) {
        msg += '💊 *الأدوية الحالية:*\n';
        STATE.meds.list.forEach(m => {
          const doses = m.doses && m.doses.length ? m.doses : [{ time: m.time || '—' }];
          msg += `   • ${m.name} ${m.dose} (${m.form || ''}) — ${doses.map(d => d.time).join('، ')}\n`;
        });
        msg += '\n';
      }
      msg += '━━━━━━━━━━━━━━━━━━━━\n';
      msg += '⚠️ هذا التقرير مُولَّد بواسطة تطبيق طبيبك (ذكاء اصطناعي) وليس تشخيصاً طبياً رسمياً.\n';
      msg += 'أرجو تقديم المشورة الدوائية المناسبة. شكراً.';
      return msg;
    }

    function refreshPharmacistScreen() {
      const phoneInput = document.getElementById('pharmPhone');
      const saved = localStorage.getItem('tabibak_pharm_phone');
      if (saved) {
        phoneInput.value = saved;
      } else if (phoneInput && !phoneInput.value) {
        phoneInput.value = '+' + PHARMACY_PHONE_DEFAULT;
      }
      const hasSession = (STATE.sessions && STATE.sessions.length > 0) || (STATE.triageSession && STATE.triageSession.result);
      const noReportEl = document.getElementById('pharmNoReport');
      const reportCard = document.getElementById('pharmReportCard');
      if (noReportEl && reportCard) {
        noReportEl.style.display = hasSession ? 'none' : '';
        reportCard.style.opacity = hasSession ? '1' : '0.5';
        reportCard.style.pointerEvents = hasSession ? '' : 'none';
      }
    }

    function getPharmPhone() {
      const el = document.getElementById('pharmPhone');
      if (el && el.value.trim()) {
        return el.value.trim();
      }
      return localStorage.getItem('tabibak_pharm_phone')
        || PHARMACY_PHONE_DEFAULT;
    }

    document.getElementById('pharmSavePhone').addEventListener('click', () => {
      const val = document.getElementById('pharmPhone').value.trim();
      if (!val) { alert('يرجى إدخال رقم الواتساب.'); return; }
      localStorage.setItem('tabibak_pharm_phone', val);
      const savedMsg = document.getElementById('pharmPhoneSaved');
      savedMsg.style.display = '';
      setTimeout(() => { savedMsg.style.display = 'none'; }, 2500);
    });

    document.getElementById('pharmQuickBtn').addEventListener('click', () => {
      const userName = STATE.currentUser?.name || 'مريض';
      const msg = `مرحباً، أنا ${userName}.\nأرغب في استشارة صيدلانية عبر تطبيق طبيبك.`;
      window.open(buildWaUrl(getPharmPhone(), msg), '_blank');
    });

    document.getElementById('pharmPreviewBtn').addEventListener('click', () => {
      const preview = document.getElementById('pharmReportPreview');
      const textEl = document.getElementById('pharmReportText');
      const isOpen = preview.style.display !== 'none';
      if (isOpen) {
        preview.style.display = 'none';
        document.getElementById('pharmPreviewBtn').innerHTML = '<i class="ti ti-eye"></i> معاينة التقرير';
      } else {
        textEl.textContent = buildPharmReport();
        preview.style.display = '';
        document.getElementById('pharmPreviewBtn').textContent = '✕ إخفاء المعاينة';
      }
    });

    document.getElementById('pharmReportBtn').addEventListener('click', () => {
      const hasSession = (STATE.sessions && STATE.sessions.length > 0) || (STATE.triageSession && STATE.triageSession.result);
      if (!hasSession) {
        alert('لا يوجد تقرير فحص بعد. يرجى إكمال جلسة فحص أولاً.');
        return;
      }
      window.open(buildWaUrl(getPharmPhone(), buildPharmReport()), '_blank');
    });

    /* ================================================================
       INIT
       ================================================================ */
    loadLocalMedsTaken();

    // Load stored BMI if any
    try {
      const storedBmi = localStorage.getItem('tabibak_bmi');
      if (storedBmi) {
        STATE.bmi = JSON.parse(storedBmi);
      }
    } catch (e) { }

    (async () => {
      await loadProfile();

      // Load Groq API Key from server dynamically to keep it out of source control
      try {
        const res = await fetch('/api/config/groq-key');
        const data = await res.json();
        if (data.keys && data.keys.length > 0) {
          STATE.apiKeys = data.keys;
          STATE.food.apiKey = data.keys[0];
        }
        if (data.medicalKeys && data.medicalKeys.length > 0) {
          STATE.medicalKeys = data.medicalKeys;
          STATE.medicalTest.apiKey = data.medicalKeys[0];
        } else if (data.keys && data.keys.length > 0) {
          STATE.medicalTest.apiKey = data.keys[0];
        }
      } catch (e) {
        console.error("Failed to load Groq API key from server", e);
      }

      // Load Google Client ID for Sign In With Google
      await loadGoogleClientId();

      refreshProfileScreen();
      refreshHistoryScreen();
      if (STATE.meds.list.length === 0) renderMedsScreen();

      // Auto-start reminder scheduler + register FCM if permission was already granted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        startReminderScheduler();
        if (STATE.currentUser) requestFcmToken();
      }

      // Pre-fill pharmacist phone from localStorage if saved previously
      const savedPhone = localStorage.getItem('tabibak_pharm_phone');
      if (savedPhone) {
        const el = document.getElementById('pharmPhone');
        if (el) el.value = savedPhone;
      } else {
        const el = document.getElementById('pharmPhone');
        if (el) el.value = '+' + PHARMACY_PHONE_DEFAULT;
      }
    })();

    // Credits Modal Show/Hide and Image Upload Handling
    const openCreditsBtn = document.getElementById('openCreditsBtn');
    const creditsModal = document.getElementById('creditsModal');
    const closeCreditsModal = document.getElementById('closeCreditsModal');

    if (openCreditsBtn && creditsModal) {
      openCreditsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        creditsModal.classList.add('open');
      });
    }

    if (closeCreditsModal && creditsModal) {
      closeCreditsModal.addEventListener('click', () => {
        creditsModal.classList.remove('open');
      });
    }

    if (creditsModal) {
      creditsModal.addEventListener('click', (e) => {
        if (e.target === creditsModal) creditsModal.classList.remove('open');
      });
    }

    // Connect hidden file inputs to dev avatars and handle uploads
    for (let i = 0; i < 5; i++) {
      const avatarWrap = document.getElementById(`devAvatarWrap_${i}`);
      const fileInput = document.getElementById(`devInput_${i}`);
      const avatarImg = document.getElementById(`devAvatarImg_${i}`);
      const placeholder = document.getElementById(`devAvatarPlaceholder_${i}`);

      if (avatarWrap && fileInput) {
        avatarWrap.addEventListener('click', () => fileInput.click());
      }

      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            alert('الحد الأقصى لحجم الصورة هو 2 ميجابايت.');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            avatarImg.src = reader.result;
            avatarImg.style.display = 'block';
            placeholder.style.display = 'none';
            try {
              localStorage.setItem(`tabibak_dev_photo_${i}`, reader.result);
            } catch (err) {
              console.error("Failed to save dev photo in localStorage", err);
            }
          };
          reader.readAsDataURL(file);
        });
      }

      // Pre-load saved developer photos from localStorage
      try {
        const savedPhoto = localStorage.getItem(`tabibak_dev_photo_${i}`);
        if (savedPhoto && avatarImg && placeholder) {
          avatarImg.src = savedPhoto;
          avatarImg.style.display = 'block';
          placeholder.style.display = 'none';
        }
      } catch (err) { }
    }

    // Initialize dose slots in modal on first render
    renderDoseSlots(1);
