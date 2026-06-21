/**
 * Splits remaining inline <style> sections into /public/css/ files.
 * Preserves exact CSS text per section header. Run: node scripts/split-inline-css.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'tabibak.html');
let html = fs.readFileSync(HTML_PATH, 'utf8');

const styleMatch = html.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
if (!styleMatch) {
  console.log('No inline <style> block — CSS already fully extracted.');
  process.exit(0);
}
const css = styleMatch[1];

const SECTIONS = [
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
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startRe = new RegExp(`/\\* =+\\s*\\n\\s*${esc(startMarker)}`, 'i');
  const startIdx = full.search(startRe);
  if (startIdx === -1) throw new Error(`Start marker not found: ${startMarker}`);
  let endIdx = full.length;
  if (endMarker) {
    const endRe = new RegExp(`/\\* =+\\s*\\n\\s*${esc(endMarker)}`, 'i');
    const found = full.search(endRe);
    if (found > startIdx) endIdx = found;
  }
  return full.slice(startIdx, endIdx).trim() + '\n';
}

const CSS_DIR = path.join(ROOT, 'public', 'css');
fs.mkdirSync(CSS_DIR, { recursive: true });

const newFiles = [];
for (const sec of SECTIONS) {
  const content = sliceCss(css, sec.start, sec.end);
  const outPath = path.join(CSS_DIR, sec.file);
  fs.writeFileSync(outPath, content);
  newFiles.push(sec.file);
  console.log('Wrote', sec.file);
}

const existingLinks = [...html.matchAll(/href="(\/public\/css\/[^"]+)"/g)].map(m => m[1]);
const allCss = [...new Set([...existingLinks, ...newFiles.map(f => `/public/css/${f}`)])];

const linkTags = allCss.map(href => `  <link rel="stylesheet" href="${href}" />`).join('\n');

html = html.replace(/\s*<style>[\s\S]*?<\/style>\s*/, '\n');
const insertAfter = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />';
if (!html.includes(insertAfter)) throw new Error('Insert anchor not found');
const tokenBase = allCss.filter(h => h.includes('tokens') || h.includes('base'));
const rest = allCss.filter(h => !h.includes('tokens') && !h.includes('base'));
const orderedLinks = [
  ...tokenBase,
  ...rest,
].map(href => `  <link rel="stylesheet" href="${href}" />`).join('\n');

html = html.replace(
  /(<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/@tabler\/icons-webfont@latest\/tabler-icons\.min\.css" \/>)[\s\S]*?(<script src="https:\/\/www\.gstatic\.com\/firebasejs)/,
  `$1\n${orderedLinks}\n  $2`
);

fs.writeFileSync(HTML_PATH, html);
console.log('Removed inline <style>. Linked', allCss.length, 'CSS files.');
