// Phase 8l: builds a plugin's .dczp package (a .zip inside) from a folder (Vite's dist/, or the plugin folder if it is
// not built). No dependencies: Node 22+ (zlib.crc32).
//   node pack.mjs <folder> [output]      ->  <output>/<id>-<version>.dczp  (default output: plugins/out)
// It runs the same checks as Docodez on install: docodez-plugin.json with a valid id/name/version, and the entry page.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(process.argv[2] ?? '.');
const outDir = resolve(process.argv[3] ?? join(here, '..', 'out'));

const fail = (message) => { console.error('pack: ' + message); process.exit(1); };
const manifestPath = join(source, 'docodez-plugin.json');
if (!existsSync(manifestPath)) fail(`missing ${manifestPath}`);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(manifest.id ?? '') || manifest.id.includes('..')) fail('invalid "id"');
if (!manifest.name?.trim()) fail('missing "name"');
if (!/^\d{1,6}(\.\d{1,6}){0,3}$/.test(manifest.version ?? '')) fail('invalid "version" (for example 1.0.0)');
const entry = manifest.entry ?? 'index.html';
// An AI-only plugin ("ai" section) has no page (Docodez accepts that).
if (!manifest.ai && !existsSync(join(source, entry))) fail(`missing entry page ${entry}`);

// All files (without source maps: the installed plugin does not need them).
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (!name.endsWith('.map')) files.push(full);
  }
})(source);

// Minimal ZIP (deflate, no encryption or zip64): local header + data per file, central directory at the end.
const chunks = [];
const central = [];
let offset = 0;
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
for (const full of files.sort()) {
  const name = Buffer.from(relative(source, full).split('\\').join('/'), 'utf8');
  const data = readFileSync(full);
  const packed = deflateRawSync(data, { level: 9 });
  const store = packed.length >= data.length;
  const body = store ? data : packed;
  const crc = crc32(data) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // UTF-8
  local.writeUInt16LE(store ? 0 : 8, 8); local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  chunks.push(local, name, body);
  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8);
  head.writeUInt16LE(store ? 0 : 8, 10); head.writeUInt16LE(dosTime, 12); head.writeUInt16LE(dosDate, 14);
  head.writeUInt32LE(crc, 16); head.writeUInt32LE(body.length, 20); head.writeUInt32LE(data.length, 24);
  head.writeUInt16LE(name.length, 28); head.writeUInt32LE(offset, 42);
  central.push(head, name);
  offset += local.length + name.length + body.length;
}
const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);

mkdirSync(outDir, { recursive: true });
const target = join(outDir, `${manifest.id}-${manifest.version}.dczp`);
writeFileSync(target, Buffer.concat([...chunks, ...central, end]));
console.log(`Done: ${target} (${files.length} files, ${(statSync(target).size / 1024).toFixed(0)} KB)`);
