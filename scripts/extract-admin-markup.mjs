import fs from 'fs';
import zlib from 'zlib';

const html = fs.readFileSync('C:/Users/kavit/Downloads/KadaBook Admin Panel.html', 'utf8');

function extractScript(type) {
  const open = `<script type="${type}">`;
  const contentStart = html.indexOf(open) + open.length;
  const end = html.indexOf('</script>', contentStart);
  return html.slice(contentStart, end).trim();
}

const manifest = JSON.parse(extractScript('__bundler/manifest'));
const order = JSON.parse(extractScript('__bundler/page_order'));
const template = JSON.parse(extractScript('__bundler/template'));

function decode(id) {
  const e = manifest[id];
  const buf = Buffer.from(e.data, 'base64');
  return (e.compressed ? zlib.gunzipSync(buf) : buf).toString('utf8');
}

function innerMarkup(raw) {
  const m = raw.match(/<x-dc>([\s\S]*)<\/x-dc>/);
  if (m) return m[1];
  return raw;
}

const titles = {};
for (const m of template.matchAll(/<h2>([^<]+)<\/h2><iframe[^#]+#([a-f0-9-]+)/g)) {
  titles[m[2]] = m[1];
}

const out = 'C:/Users/kavit/Desktop/kadabook/design/pages';
fs.mkdirSync(out, { recursive: true });

for (const id of order) {
  const title = titles[id];
  const markup = innerMarkup(decode(id));
  const safe = title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  fs.writeFileSync(`${out}/${safe}.snippet.html`, markup.slice(0, 80000));
  console.log(title, markup.length);
}

const dash = innerMarkup(decode(order[0]));
const navMatch = dash.match(/Dashboard[\s\S]{0,800}/);
console.log('nav sample', navMatch?.[0]?.slice(0, 400));
