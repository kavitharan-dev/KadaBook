import fs from 'fs';
import zlib from 'zlib';

const html = fs.readFileSync('C:/Users/kavit/Downloads/KadaBook Admin Panel.html', 'utf8');
const open = '<script type="__bundler/manifest">';
const start = html.indexOf(open) + open.length;
const manifest = JSON.parse(html.slice(start, html.indexOf('</script>', start)).trim());
const t = zlib
  .gunzipSync(Buffer.from(manifest['a2979293-39a1-4b05-a184-3087ed6648b0'].data, 'base64'))
  .toString('utf8')
  .replace(/\\u002F/g, '/')
  .replace(/\\n/g, '\n');

const bg = [...t.matchAll(/background:#([0-9A-Fa-f]{3,8})/gi)].map((x) => '#' + x[1]);
console.log('backgrounds', [...new Set(bg)]);
const borders = [...t.matchAll(/border[^;]*#([0-9A-Fa-f]{3,8})/gi)].map((x) => '#' + x[1]);
console.log('borders', [...new Set(borders)].slice(0, 10));
