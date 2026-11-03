import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { init, parse } from 'es-module-lexer';

await init;
const root = path.resolve('dist/public');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const entries = [...html.matchAll(/<script\b[^>]*>/g)]
  .map(([tag]) => /type="module"/.test(tag) ? tag.match(/src="([^"]+)"/)?.[1] : null)
  .filter(Boolean);
const preloads = [...html.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) => /rel="modulepreload"/.test(tag) ? tag.match(/href="([^"]+)"/)?.[1] : null)
  .filter(Boolean);
const seen = new Set();
function visit(url) {
  const relative = url.replace(/^\//, '');
  if (seen.has(relative)) return;
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`Missing static import: ${relative}`);
  seen.add(relative);
  const code = fs.readFileSync(file, 'utf8');
  for (const item of parse(code)[0]) {
    if (item.d !== -1 || !item.n) continue;
    if (item.n.startsWith('.')) visit(path.posix.join(path.posix.dirname(relative), item.n));
    else if (item.n.startsWith('/')) visit(item.n);
  }
}
for (const entry of [...entries, ...preloads]) visit(entry);
const files = [...seen].map(file => {
  const bytes = fs.readFileSync(path.join(root, file));
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}).sort((a, b) => b.bytes - a.bytes);
const css = [...html.matchAll(/<link\b[^>]*>/g)]
  .map(([tag]) => /rel="stylesheet"/.test(tag) ? tag.match(/href="([^"]+)"/)?.[1] : null)
  .filter(url => url?.startsWith('/')).map(url => {
    const bytes = fs.readFileSync(path.join(root, url));
    return { file: url, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
  });
const totals = rows => ({ files: rows.length, bytes: rows.reduce((n, r) => n + r.bytes, 0), gzipBytes: rows.reduce((n, r) => n + r.gzipBytes, 0) });
const report = {
  entries, initialStaticJs: totals(files), initialCss: totals(css),
  largestInitialJs: files.slice(0, 12),
  note: 'Static import closure plus HTML modulepreload; excludes dynamic routes, fonts, external scripts, images and API data. Gzip is estimated locally, not measured from deployed HTTP responses.',
};
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--check") && report.initialStaticJs.gzipBytes > 270_000) { console.error("Initial JS gzip exceeds the 270 kB budget"); process.exitCode = 1; }
