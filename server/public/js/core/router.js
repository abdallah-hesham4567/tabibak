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
