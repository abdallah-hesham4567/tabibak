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
