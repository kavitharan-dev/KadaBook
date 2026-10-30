import fs from 'fs';
import zlib from 'zlib';

const htmlPath = 'C:/Users/kavit/Downloads/KadaBook Admin Panel.html';
const html = fs.readFileSync(htmlPath, 'utf8');

function extractScript(type) {
  const open = `<script type="${type}">`;
  const start = html.indexOf(open);
  if (start === -1) return null;
  const contentStart = start + open.length;
  const end = html.indexOf('</script>', contentStart);
  return html.slice(contentStart, end).trim();
}

const pageOrder = JSON.parse(extractScript('__bundler/page_order'));
const template = JSON.parse(extractScript('__bundler/template'));
const manifest = JSON.parse(extractScript('__bundler/manifest'));

const titleById = {};
for (const m of template.matchAll(/<h2>([^<]+)<\/h2><iframe[^#]+#([a-f0-9-]+)/g)) {
  titleById[m[2]] = m[1];
}

const outDir = 'C:/Users/kavit/Desktop/kadabook/design/extracted';
fs.mkdirSync(outDir, { recursive: true });

const meta = [];

for (const id of pageOrder) {
  const entry = manifest[id];
  if (!entry) continue;
  const buf = Buffer.from(entry.data, 'base64');
  const raw = entry.compressed ? zlib.gunzipSync(buf) : buf;
  const pageHtml = raw.toString('utf8');
  const title = titleById[id] ?? id;
  const safe = title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  fs.writeFileSync(`${outDir}/${safe}.html`, pageHtml);
  meta.push({ id, title, file: `${safe}.html` });
  console.log(title, pageHtml.length);
}

fs.writeFileSync(`${outDir}/meta.json`, JSON.stringify(meta, null, 2));

// Copy design reference
fs.copyFileSync(htmlPath, 'C:/Users/kavit/Desktop/kadabook/design/KadaBook-Admin-Panel.html');
console.log('done');
