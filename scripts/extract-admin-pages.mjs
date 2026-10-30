import fs from 'fs';
import zlib from 'zlib';

const htmlPath = 'C:/Users/kavit/Downloads/KadaBook Admin Panel.html';
const html = fs.readFileSync(htmlPath, 'utf8');

function extractScript(type) {
  const open = `<script type="${type}">`;
  const start = html.indexOf(open);
  const contentStart = start + open.length;
  const end = html.indexOf('</script>', contentStart);
  return html.slice(contentStart, end).trim();
}

function decodeEntry(entry) {
  const buf = Buffer.from(entry.data, 'base64');
  const raw = entry.compressed ? zlib.gunzipSync(buf) : buf;
  return raw.toString('utf8');
}

const manifest = JSON.parse(extractScript('__bundler/manifest'));
const pageOrder = JSON.parse(extractScript('__bundler/page_order'));
const template = JSON.parse(extractScript('__bundler/template'));

const titleById = {};
for (const m of template.matchAll(/<h2>([^<]+)<\/h2><iframe[^#]+#([a-f0-9-]+)/g)) {
  titleById[m[2]] = m[1];
}

/** Follow nested bundler pages until we get x-dc content or plain body HTML. */
function unwrapPage(htmlText, depth = 0) {
  if (depth > 5) return htmlText;
  const innerJson = htmlText.match(/^"<!DOCTYPE html>/);
  if (htmlText.startsWith('"<!DOCTYPE') || htmlText.startsWith('"\\n<!DOCTYPE')) {
    try {
      const unescaped = JSON.parse(htmlText);
      return unwrapPage(unescaped, depth + 1);
    } catch {
      /* continue */
    }
  }
  if (htmlText.includes('<x-dc>')) {
    const start = htmlText.indexOf('<x-dc>');
    const end = htmlText.lastIndexOf('</x-dc>');
    if (end > start) return htmlText.slice(start, end + 7);
  }
  return htmlText;
}

const outDir = 'C:/Users/kavit/Desktop/kadabook/design/pages';
fs.mkdirSync(outDir, { recursive: true });

const tokens = new Set();

for (const id of pageOrder) {
  const title = titleById[id];
  let page = decodeEntry(manifest[id]);
  page = unwrapPage(page.trim());
  // If still wrapper, try JSON.parse whole file
  if (page.includes('__bundler/page_order')) {
    const match = page.match(/"<!DOCTYPE html>\\n<html[^"]+/);
    if (match) {
      try {
        page = JSON.parse('"' + match[0].slice(1));
      } catch {
        /* */
      }
    }
  }
  const safe = title.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  fs.writeFileSync(`${outDir}/${safe}.html`, page);
  console.log(title, page.length, page.slice(0, 80).replace(/\n/g, ' '));

  for (const c of page.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) tokens.add(c[1]);
  for (const c of page.matchAll(/bg-\[[^\]]+\]/g)) tokens.add(c[0]);
  for (const c of page.matchAll(/text-\[[^\]]+\]/g)) tokens.add(c[0]);
}

fs.writeFileSync(`${outDir}/colors-sample.txt`, [...tokens].slice(0, 80).join('\n'));
console.log('colors sample', [...tokens].length);
