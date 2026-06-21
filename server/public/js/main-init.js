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

// Initialize dose slots in modal on first render
renderDoseSlots(1);
