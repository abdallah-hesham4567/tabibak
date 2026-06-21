/**
 * Verifies every /public/ asset linked from tabibak.html exists on disk.
 * Run: node scripts/verify-assets.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'tabibak.html'), 'utf8');

const hrefs = [...html.matchAll(/href="(\/public\/[^"]+)"/g)].map(m => m[1]);
const srcs = [...html.matchAll(/src="(\/public\/[^"]+)"/g)].map(m => m[1]);
const paths = [...new Set([...hrefs, ...srcs])];

let failed = false;
for (const urlPath of paths) {
  const filePath = path.join(ROOT, urlPath.replace(/^\//, '').replace(/\//g, path.sep));
  if (!fs.existsSync(filePath)) {
    console.error('MISSING:', urlPath, '→', filePath);
    failed = true;
  } else {
    console.log('OK:', urlPath);
  }
}

if (failed) {
  process.exit(1);
}
console.log('All', paths.length, 'assets verified.');
