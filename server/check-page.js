/**
 * Smoke checks for tabibak.html after refactors.
 * Usage: TABIBAK_URL=http://localhost:3000/tabibak.html node check-page.js
 */
const { chromium } = require('playwright');

const BASE_URL = process.env.TABIBAK_URL || 'http://localhost:3000/tabibak.html';

const REQUIRED_IDS = [
  'welcomeScreen',
  'screen-landing',
  'screen-chat',
  'screen-breathing',
  'screen-results',
  'screen-meds',
  'screen-food',
  'screen-medical-test',
  'screen-bmi',
  'screen-profile',
  'screen-history',
  'screen-pharmacist',
  'screen-mentor',
  'chatLog',
  'chatInput',
  'sendBtn',
  'themeBtn',
];

const NAV_TABS = ['landing', 'meds', 'history', 'food', 'medical-test', 'bmi', 'pharmacist', 'mentor'];

const SCREEN_MAP = {
  landing: 'screen-landing',
  meds: 'screen-meds',
  history: 'screen-history',
  food: 'screen-food',
  'medical-test': 'screen-medical-test',
  bmi: 'screen-bmi',
  pharmacist: 'screen-pharmacist',
  mentor: 'screen-mentor',
};

(async () => {
  let failed = false;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    console.log('URL:', page.url());
    console.log('Title:', await page.title());

    const missing = [];
    for (const id of REQUIRED_IDS) {
      const el = await page.$(`#${id}`);
      if (!el) missing.push(id);
    }
    if (missing.length) {
      failed = true;
      console.error('Missing DOM IDs:', missing.join(', '));
    } else {
      console.log('All', REQUIRED_IDS.length, 'required DOM IDs present');
    }

    const tokensCss = await page.evaluate(() => {
      return [...document.styleSheets].some(s => {
        try {
          return s.href && s.href.includes('/public/css/tokens.css');
        } catch (e) {
          return false;
        }
      });
    });
    if (!tokensCss) {
      failed = true;
      console.error('tokens.css not loaded');
    } else {
      console.log('tokens.css loaded');
    }

    for (const tab of NAV_TABS) {
      const btn = await page.$(`.nav-btn[data-tab="${tab}"]`);
      if (!btn) {
        failed = true;
        console.error('Nav button missing:', tab);
        continue;
      }
      await btn.click();
      await page.waitForTimeout(300);
      const screenId = SCREEN_MAP[tab];
      const active = await page.$eval(`#${screenId}`, el => el.classList.contains('active'));
      if (!active) {
        failed = true;
        console.error('Tab failed:', tab, '→', screenId, 'not active');
      } else {
        console.log('Tab OK:', tab);
      }
    }

    if (errors.length) {
      failed = true;
      console.error('Console/page errors:');
      errors.forEach(e => console.error(' ', e));
    } else {
      console.log('No console errors');
    }
  } catch (err) {
    failed = true;
    console.error('Check failed:', err.message);
  } finally {
    await browser.close();
  }

  process.exit(failed ? 1 : 0);
})();
