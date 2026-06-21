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
