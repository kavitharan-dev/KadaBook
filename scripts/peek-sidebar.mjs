import fs from 'fs';
import zlib from 'zlib';

const html = fs.readFileSync('C:/Users/kavit/Downloads/KadaBook Admin Panel.html', 'utf8');
const open = '<script type="__bundler/manifest">';
const start = html.indexOf(open) + open.length;
const manifest = JSON.parse(html.slice(start, html.indexOf('</script>', start)).trim());
const id = 'a2979293-39a1-4b05-a184-3087ed6648b0';
const t = zlib.gunzipSync(Buffer.from(manifest[id].data, 'base64')).toString('utf8');

function unescapeJsonFragment(s) {
  return s.replace(/\\u002F/g, '/').replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

const sidebar = t.match(/width:240px[\s\S]{0,3500}/);
console.log(unescapeJsonFragment(sidebar?.[0] ?? '').slice(0, 2000));

const metrics = [...t.matchAll(/font-size:28px[^>]*>([^<\\]+)/g)].slice(0, 6);
console.log('metrics', metrics.map((m) => unescapeJsonFragment(m[1])));
