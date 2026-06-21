/**
 * Splits entire inline <script> into ordered /public/js/ files by section headers.
 * Preserves exact code and execution order. Run: node scripts/split-all-js.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'tabibak.html');
let html = fs.readFileSync(HTML_PATH, 'utf8');

const scriptRe = /<script>\s*([\s\S]*?)\s*<\/script>\s*\n\s*<script src="https:\/\/cdnjs/;
const scriptMatch = html.match(scriptRe);
if (!scriptMatch) {
  console.log('No inline script block — JS already fully extracted.');
  process.exit(0);
}
const js = scriptMatch[1];

const SECTION_RE = /\/\* ={10,}\s*\n\s*([^\n*]+?)\s*\n\s*=+ \*\//g;

const FILE_MAP = {
  'STORAGE': 'services/storage.js',
  'GOLE SIGN-IN': 'features/google-auth.js',
  'VERIFICATION CODE': 'features/verification.js',
  'NAVIGATION': 'core/router.js',
  'MENTOR MODULE': 'features/mentor.js',
  'THEME TOGGLE': 'features/theme.js',
  'BREATHING AUDIO MODULE': 'features/breathing/audio.js',
  'MEDICATION REMINDER MODULE': 'features/meds/render.js',
  'ADD MEDICATION MODAL': 'features/meds/modal.js',
  'BROWSER PUSH NOTIFICATIONS — REMINDER SCHEDULER': 'services/reminder-scheduler.js',
  'FCM PUSH NOTIFICATIONS — Firebase Cloud Messaging': 'services/fcm.js',
  'TRIAGE CHAT ENGINE': 'features/triage/index.js',
  'BREATHING TEST': 'features/breathing/exercise.js',
  'BMI CALCULATOR': 'features/bmi.js',
  'NUTRITION ADVISOR': 'features/food/index.js',
  'MEDICAL TEST ANALYZER': 'features/medical-test/index.js',
  'AUTH': 'features/auth.js',
  'NOTIFICATION PERMISSION MODAL': 'features/profile.js',
  'HISTORY': 'features/history.js',
  'PHARMACIST MODULE': 'features/pharmacist.js',
  'INIT': 'main-init.js',
};

const sections = [];
let m;
while ((m = SECTION_RE.exec(js)) !== null) {
  sections.push({ title: m[1].trim(), start: m.index, headerEnd: m.index + m[0].length });
}

if (sections.length === 0) {
  console.error('No sections found');
  process.exit(1);
}

const files = [];
for (let i = 0; i < sections.length; i++) {
  const sec = sections[i];
  const codeStart = sec.headerEnd;
  const codeEnd = i + 1 < sections.length ? sections[i + 1].start : js.length;
  const code = js.slice(codeStart, codeEnd).trim();
  const relPath = FILE_MAP[sec.title];
  if (!relPath) {
    console.error('Unmapped section:', sec.title);
    process.exit(1);
  }
  const outPath = path.join(ROOT, 'public', 'js', relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, code + '\n');
  files.push(relPath);
  console.log('Wrote', relPath, `(${code.length} chars) —`, sec.title);
}

const existingScripts = [
  'features/welcome.js',
  'core/api.js',
  'core/state.js',
];
const allScripts = [...existingScripts, ...files];
const scriptTags = allScripts.map(f => `  <script src="/public/js/${f}"></script>`).join('\n');

html = html.replace(
  /  <script src="\/public\/js\/features\/welcome\.js"><\/script>\s*<script src="\/public\/js\/core\/api\.js"><\/script>\s*<script src="\/public\/js\/core\/state\.js"><\/script>\s*<script>[\s\S]*?<\/script>\s*\n\s*/,
  scriptTags + '\n\n  '
);

fs.writeFileSync(HTML_PATH, html);
console.log('\nExtracted', files.length, 'JS sections. Inline script removed.');
