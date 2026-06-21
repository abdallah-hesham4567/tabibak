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
      document.getElementById('medsAdherenceStat').textContent = `${pct}%`;
      document.getElementById('medsStreakStat').textContent = STATE.meds.streak || 5;
      document.getElementById('medsMissedStat').textContent = STATE.meds.missedWeek || 1;

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
              try { await api('DELETE', '/api/medications/' + id); } catch (e) { }
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
