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
