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

    // function askNextQuestion() {
    //   const step = STATE.triageSession.step;
    //   if (step >= TRIAGE_QUESTIONS.length) { finishTriage(); return; }
    //   const q = TRIAGE_QUESTIONS[step];
    //   document.getElementById('categoryBadge').textContent = q.category;
    //   updateProgress(step, TRIAGE_QUESTIONS.length);
    //   showTypingThenAppend(q.q);
    // }
    // REPLACE the existing askNextQuestion with this:
    function askNextQuestion() {
      const step = STATE.triageSession.step;
      if (step >= TRIAGE_QUESTIONS.length) { finishTriage(); return; }
      const q = TRIAGE_QUESTIONS[step];
      document.getElementById('categoryBadge').textContent = q.category;
      updateProgress(step, TRIAGE_QUESTIONS.length);

      const SUGGESTIONS = [
        ['منذ يومين', 'منذ أسبوع', 'منذ ساعات قليلة', 'أكثر من شهر'],      // step 0: duration
        ['1 - 2', '3 - 5', '6 - 7', '8 - 10'],                              // step 1: severity  
        ['لا يوجد', 'ضغط الدم', 'السكري', 'ربو', 'أدوية منتظمة'],           // step 2: history
        ['نعم، وتعافيت', 'نعم، ولا زلت أعاني', 'لا، للمرة الأولى'],         // step 3: prior
        ['لا توجد حساسية', 'حساسية من البنسلين', 'حساسية من الأسبرين'],      // step 4: allergy
      ];

      showTypingThenAppend(q.q).then(() => {
        showSuggestions(SUGGESTIONS[step] || []);
      });
    }

    function startTriage(initialSymptom, breathingContext = '') {
      // If chat is already in progress and hasn't finished, don't restart
      if (STATE.triageSession.chatLog.length > 0 && !STATE.triageSession.result) {
        showTab('chat');
        return;
      }
      // If called with no symptom and chat is active, just show it
      if (!initialSymptom && STATE.triageSession.chatLog.length > 0) {
        showTab('chat');
        return;
      }

      // Only reset if this is a new session
      STATE.triageSession = {
        symptom: initialSymptom, chatLog: [], step: 0,
        totalSteps: TRIAGE_QUESTIONS.length, category: 'عام',
        redFlagFired: false, result: null,
      };

      showTab('chat');
      document.getElementById('chatLog').innerHTML = '';
      document.getElementById('redFlagBanner').classList.remove('visible');
      updateProgress(0, TRIAGE_QUESTIONS.length);

      const intro = breathingContext
        ? `مرحباً! أنا طبيبك. بناءً على نتيجة تقييم التنفس (${breathingContext})، وعَرَضك المُبلَّغ عنه "${initialSymptom}" — سأطرح عليك بعض الأسئلة لفهم حالتك بشكل أفضل.`
        : `مرحباً! أنا طبيبك. لاحظتُ عَرَضك: "${initialSymptom}". سأطرح عليك ${TRIAGE_QUESTIONS.length} أسئلة سريعة لفهم حالتك بشكل أفضل.`;

      appendMessage('bot', intro);
      checkRedFlags(initialSymptom);
      setTimeout(askNextQuestion, 600);
    }

    function handleUserChatInput(imgDataUrl) {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text && !imgDataUrl) return;
      input.value = '';
      appendMessage('user', text, imgDataUrl);
      checkRedFlags(text);
      STATE.triageSession.step++;
      updateProgress(STATE.triageSession.step, TRIAGE_QUESTIONS.length);
      if (STATE.triageSession.step < TRIAGE_QUESTIONS.length) {
        setTimeout(askNextQuestion, 400);
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
