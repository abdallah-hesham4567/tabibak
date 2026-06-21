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
      const sessions = STATE.sessions || [];
      const lastSession = sessions.length > 0 ? parseSession(sessions[0]) : null;
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
      const hasSession = STATE.sessions && STATE.sessions.length > 0;
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
      const hasSession = STATE.sessions && STATE.sessions.length > 0;
      if (!hasSession) {
        alert('لا يوجد تقرير فحص بعد. يرجى إكمال جلسة فحص أولاً.');
        return;
      }
      window.open(buildWaUrl(getPharmPhone(), buildPharmReport()), '_blank');
    });
