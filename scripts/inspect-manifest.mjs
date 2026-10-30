import fs from 'fs';

const html = fs.readFileSync('C:/Users/kavit/Downloads/KadaBook Admin Panel.html', 'utf8');
const open = '<script type="__bundler/manifest">';
const start = html.indexOf(open) + open.length;
const end = html.indexOf('</script>', start);
const manifest = JSON.parse(html.slice(start, end).trim());
const k = 'a2979293-39a1-4b05-a184-3087ed6648b0';
console.log('keys on entry', Object.keys(manifest[k] ?? {}));
const entry = manifest[k];
if (entry?.sources) console.log('sources', entry.sources.length, entry.sources[0]?.slice?.(0, 200));
if (entry?.css) console.log('css len', entry.css?.length);
for (const key of Object.keys(entry ?? {})) {
  const v = entry[key];
  console.log(key, typeof v, Array.isArray(v) ? v.length : typeof v === 'string' ? v.length : '');
}
