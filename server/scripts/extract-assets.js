/**
 * One-time extraction: splits inline CSS/JS from tabibak.html into public/ assets.
 * Run: node scripts/extract-assets.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'tabibak.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// --- Extract CSS ---
const styleMatch = html.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
if (!styleMatch) throw new Error('No <style> block found');
const css = styleMatch[1];

const CSS_DIR = path.join(ROOT, 'public', 'css');
const CSS_SECTIONS = [
  { file: 'tokens.css', start: 'DESIGN TOKENS', end: 'LAYOUT' },
  { file: 'layout.css', start: 'LAYOUT', end: 'HEADER & NAV' },
  { file: 'header-nav.css', start: 'HEADER & NAV', end: 'SCREENS' },
  { file: 'screens.css', start: 'SCREENS', end: 'GLASS PANEL' },
  { file: 'glass.css', start: 'GLASS PANEL', end: 'FORMS' },
  { file: 'forms.css', start: 'FORMS', end: 'BUTTONS' },
  { file: 'buttons.css', start: 'BUTTONS', end: 'LANDING SCREEN' },
  { file: 'landing.css', start: 'LANDING SCREEN', end: 'CHAT SCREEN' },
  { file: 'chat.css', start: 'CHAT SCREEN', end: 'BREATHING TEST SCREEN' },
  { file: 'breathing.css', start: 'BREATHING TEST SCREEN', end: 'RESULTS SCREEN' },
  { file: 'results.css', start: 'RESULTS SCREEN', end: 'NUTRITION SCREEN' },
  { file: 'nutrition.css', start: 'NUTRITION SCREEN', end: 'BMI SCREEN' },
  { file: 'bmi.css', start: 'BMI SCREEN', end: 'PROFILE / AUTH SCREENS' },
  { file: 'profile-auth.css', start: 'PROFILE / AUTH SCREENS', end: 'HISTORY SCREEN' },
  { file: 'history.css', start: 'HISTORY SCREEN', end: 'MODAL' },
  { file: 'modal.css', start: 'MODAL', end: 'MEDICATION REMINDER SCREEN' },
  { file: 'meds.css', start: 'MEDICATION REMINDER SCREEN', end: 'ADD MEDICATION MODAL (bottom sheet)' },
  { file: 'meds-modal.css', start: 'ADD MEDICATION MODAL (bottom sheet)', end: 'FCM SETTINGS PANEL' },
  { file: 'fcm.css', start: 'FCM SETTINGS PANEL', end: 'FOOTER' },
  { file: 'footer.css', start: 'FOOTER', end: 'PHARMACIST SCREEN' },
  { file: 'pharmacist.css', start: 'PHARMACIST SCREEN', end: 'KEYFRAMES' },
  { file: 'animations.css', start: 'KEYFRAMES', end: 'RESPONSIVE' },
  { file: 'responsive.css', start: 'RESPONSIVE', end: 'WELCOME SPLASH SCREEN' },
  { file: 'welcome-credits.css', start: 'WELCOME SPLASH SCREEN', end: null },
];

function sliceCss(full, startMarker, endMarker) {
  const startRe = new RegExp(`/\\* =+\\s*\\n\\s*${startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  const startIdx = full.search(startRe);
  if (startIdx === -1) return `/* Section not found: ${startMarker} */\n`;
  let endIdx = full.length;
  if (endMarker) {
    const endRe = new RegExp(`/\\* =+\\s*\\n\\s*${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    const found = full.search(endRe);
    if (found > startIdx) endIdx = found;
  }
  return full.slice(startIdx, endIdx).trim() + '\n';
}

fs.mkdirSync(CSS_DIR, { recursive: true });
for (const sec of CSS_SECTIONS) {
  const content = sliceCss(css, sec.start, sec.end);
  fs.writeFileSync(path.join(CSS_DIR, sec.file), content);
}

const mainCss = `/* Tabibak — assembled styles */\n` + CSS_SECTIONS.map(s => `@import url('./${s.file}');`).join('\n') + '\n';
fs.writeFileSync(path.join(CSS_DIR, 'main.css'), mainCss);
console.log('CSS:', CSS_SECTIONS.length, 'files written to public/css/');

// --- Extract raw JS for module splitting ---
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*\n\s*<script src="https:\/\/cdnjs/);
if (!scriptMatch) throw new Error('No main <script> block found');
const js = scriptMatch[1];
fs.writeFileSync(path.join(ROOT, 'public', 'js', '_legacy-inline.js'), js);
console.log('JS: legacy inline saved to public/js/_legacy-inline.js (', js.length, 'chars)');
