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
