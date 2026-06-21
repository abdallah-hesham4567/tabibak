/**
 * Splits one JS section from inline <script> into /public/js/ by marker name.
 * Usage: node scripts/split-inline-js.js "STORAGE"
 * Run repeatedly for each section until inline script is empty → then remove <script> block.
 */
const fs = require('fs');
const path = require('path');

const marker = process.argv[2];
if (!marker) {
  console.error('Usage: node split-inline-js.js "SECTION MARKER"');
  console.error('Example: node split-inline-js.js "STORAGE"');
  process.exit(1);
}

const OUT_MAP = {
  'STORAGE': 'services/storage.js',
  'GOLE SIGN-IN': 'features/google-auth.js',
  'NAVIGATION': 'core/router.js',
  'MENTOR MODULE': 'features/mentor.js',
  'THEME TOGGLE': 'features/theme.js',
  'BREATHING AUDIO MODULE': 'features/breathing/audio.js',
  'MEDICATION REMINDER MODULE': 'features/meds/index.js',
  'FCM': 'services/fcm.js',
  'TRIAGE CHAT ENGINE': 'features/triage/index.js',
  'BREATHING': 'features/breathing/exercise.js',
  'BMI': 'features/bmi.js',
  'NUTRITION ADVISOR': 'features/food/index.js',
  'MEDICAL TEST ANALYZER': 'features/medical-test/index.js',
  'AUTH': 'features/auth.js',
  'NOTIFICATION PERMISSION MODAL': 'features/notification-modal.js',
  'PROFILE': 'features/profile.js',
  'HISTORY': 'features/history.js',
  'PHARMACIST MODULE': 'features/pharmacist.js',
  'INIT': 'main-init.js',
};

const outFile = OUT_MAP[marker];
if (!outFile) {
  console.error('Unknown marker. Known:', Object.keys(OUT_MAP).join(', '));
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'tabibak.html');
let html = fs.readFileSync(HTML_PATH, 'utf8');

const scriptRe = /<script>\s*([\s\S]*?)\s*<\/script>\s*\n\s*<script src="https:\/\/cdnjs/;
const scriptMatch = html.match(scriptRe);
if (!scriptMatch) {
  console.error('No inline <script> block found before pdf.js');
  process.exit(1);
}
const js = scriptMatch[1];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startRe = new RegExp(`/\\* =+\\s*\\n\\s*${esc(marker)}`, 'i');
const startIdx = js.search(startRe);
if (startIdx === -1) {
  console.error('Marker not found in inline script:', marker);
  process.exit(1);
}

const afterStart = js.slice(startIdx);
const nextSectionRe = /\n\s*\/\* ={10,}/g;
nextSectionRe.exec(afterStart); // skip first (our section header)
const nextMatch = nextSectionRe.exec(afterStart);
const endIdx = nextMatch ? startIdx + nextMatch.index : js.length;

const sectionCode = js.slice(startIdx, endIdx).replace(/^\/\* =+[\s\S]*?=+\s*\*\/\s*/, '').trim();
const outPath = path.join(ROOT, 'public', 'js', outFile);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sectionCode + '\n');
console.log('Wrote', outPath, `(${sectionCode.length} chars)`);

const remainingJs = (js.slice(0, startIdx) + js.slice(endIdx)).trim();
const scriptSrc = `/public/js/${outFile}`;
const srcTag = `  <script src="${scriptSrc}"></script>\n`;

if (remainingJs) {
  html = html.replace(scriptRe, `<script>\n${remainingJs}\n  </script>\n\n  <script src="https://cdnjs`);
} else {
  html = html.replace(scriptRe, `<script src="https://cdnjs`);
}

const welcomeBlock = html.indexOf('<script src="/public/js/features/welcome.js">');
const apiBlock = html.indexOf('<script src="/public/js/core/api.js">');
const insertBefore = html.indexOf('  <script>\n', Math.max(welcomeBlock, apiBlock));
const lastCoreScript = html.lastIndexOf('<script src="/public/js/', insertBefore);
const insertPos = html.indexOf('\n', lastCoreScript) + 1;
if (!html.includes(scriptSrc)) {
  html = html.slice(0, insertPos) + srcTag + html.slice(insertPos);
}

fs.writeFileSync(HTML_PATH, html);
console.log('Updated tabibak.html. Inline script remaining:', remainingJs.length, 'chars');
