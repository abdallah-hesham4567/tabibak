/* ================================================================
   WELCOME SCREEN ANIMATION
   ================================================================ */
function startWelcomeAnimation() {
  const text = "أهلاً بك في طبيبك ✨ نتمنى لك الشفاء العاجل ❤️🩺";
  const container = document.getElementById('welcomeTextContainer');
  if (!container) return;

  const words = text.split(" ");
  container.innerHTML = words.map(w => {
    const isHighlight = w.includes("طبيبك") || w.includes("الشفاء");
    const cls = isHighlight ? "welcome-word welcome-word-highlight" : "welcome-word";
    return `<span class="${cls}">${w}</span>`;
  }).join(" ");

  setTimeout(() => {
    const bar = document.getElementById('welcomeProgressBar');
    if (bar) bar.style.width = '100%';
  }, 50);

  const wordSpans = container.querySelectorAll('.welcome-word');
  wordSpans.forEach((span, idx) => {
    setTimeout(() => {
      span.classList.add('visible');
    }, idx * 250 + 100);
  });

  setTimeout(() => {
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) {
      welcome.classList.add('fade-out');
      setTimeout(() => {
        welcome.remove();
      }, 800);
    }
  }, 5000);
}

startWelcomeAnimation();

// Tap/click anywhere on welcome screen to skip intro immediately
document.getElementById('welcomeScreen')?.addEventListener('click', dismissWelcome);
document.getElementById('welcomeScreen')?.addEventListener('touchstart', dismissWelcome, { passive: true });

function dismissWelcome() {
  const welcome = document.getElementById('welcomeScreen');
  if (!welcome || welcome.classList.contains('fade-out')) return;
  welcome.classList.add('fade-out');
  setTimeout(() => welcome.remove(), 800);
}
