function saveStorage() {
      try {
        STATE.meds.taken = STATE.meds.taken || {};
        localStorage.setItem('tabibak_meds_taken', JSON.stringify({
          date: new Date().toDateString(),
          taken: STATE.meds.taken,
          streak: STATE.meds.streak,
          missed: STATE.meds.missedWeek,
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
            STATE.meds.streak = parsed.streak || 0;
            STATE.meds.missedWeek = parsed.missed || 0;
          }
        }
      } catch (e) { }
    }
