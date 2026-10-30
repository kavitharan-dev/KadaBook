import fs from 'fs';
import zlib from 'zlib';

const html = fs.readFileSync('C:/Users/kavit/Downloads/KadaBook Admin Panel.html', 'utf8');
const open = '<script type="__bundler/manifest">';
const start = html.indexOf(open) + open.length;
const end = html.indexOf('</script>', start);
const manifest = JSON.parse(html.slice(start, end).trim());
const id = 'a2979293-39a1-4b05-a184-3087ed6648b0';
const buf = Buffer.from(manifest[id].data, 'base64');
const t = zlib.gunzipSync(buf).toString('utf8');
console.log('len', t.length);
console.log('x-dc', t.includes('<x-dc>'));
console.log('Needs attention', t.includes('Needs attention'));
console.log('sidebar', t.match(/sidebar|Sidebar/gi)?.slice(0, 5));
const idx = t.indexOf('Needs attention');
if (idx >= 0) console.log(t.slice(idx - 200, idx + 400));
else {
  const j = t.indexOf('KadaBook Admin');
  console.log('sample', t.slice(j, j + 800));
}
