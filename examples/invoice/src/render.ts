// The pages (layout.ts) drawn as SVG (preview and web page), on a canvas (PNG image) and as PDF. The PDF is written
// right here, with no libraries: real text in Helvetica (it can be selected and searched), the logo with its
// transparency, compressed with the browser's deflate.
import { type Op, type Page, measure } from './layout';

const FONT = 'Helvetica, Arial, sans-serif';
const escXml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const anchor = (a?: string) => (a === 'right' ? 'end' : a === 'center' ? 'middle' : 'start');

/** A page as SVG (viewBox in points: it scales by itself). */
export function pageSvg(p: Page): string {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}" height="${p.h}" font-family="${FONT}">`,
    `<rect width="${p.w}" height="${p.h}" fill="#ffffff"/>`];
  for (const o of p.ops) {
    if (o.t === 'rect') {
      parts.push(`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}"${o.r ? ` rx="${o.r}"` : ''} fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.lw ?? 1}"` : ''}/>`);
    } else if (o.t === 'line') {
      parts.push(`<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.color}" stroke-width="${o.lw}"/>`);
    } else if (o.t === 'text') {
      parts.push(`<text x="${o.x}" y="${o.y}" font-size="${o.size}"${o.bold ? ' font-weight="bold"' : ''} fill="${o.color}" text-anchor="${anchor(o.align)}" xml:space="preserve">${escXml(o.text)}</text>`);
    } else {
      parts.push(`<image href="${o.src}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" preserveAspectRatio="xMidYMid meet"/>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

/** The invoice as a web page (to send or open in a browser; prints one sheet per page). */
export function invoiceHtml(pages: Page[], title: string, lang: string): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escXml(title)}</title><style>
body{margin:0;background:#e9ecef;font-family:${FONT}}
.page{max-width:${pages[0]?.w ?? 612}pt;margin:16px auto;box-shadow:0 2px 12px rgba(0,0,0,.18);background:#fff}
.page svg{display:block;width:100%;height:auto}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;break-after:page}}
</style></head><body>${pages.map((p) => `<div class="page">${pageSvg(p)}</div>`).join('')}</body></html>`;
}

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image'));
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
}

/** Draws a page on a canvas (scale = pixels per point). */
async function drawPage(g: CanvasRenderingContext2D, p: Page, top: number): Promise<void> {
  g.fillStyle = '#ffffff';
  g.fillRect(0, top, p.w, p.h);
  for (const o of p.ops) {
    if (o.t === 'rect') {
      g.beginPath();
      if (o.r) g.roundRect(o.x, top + o.y, o.w, o.h, o.r); else g.rect(o.x, top + o.y, o.w, o.h);
      if (o.fill) { g.fillStyle = o.fill; g.fill(); }
      if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw ?? 1; g.stroke(); }
    } else if (o.t === 'line') {
      g.beginPath();
      g.moveTo(o.x1, top + o.y1);
      g.lineTo(o.x2, top + o.y2);
      g.strokeStyle = o.color;
      g.lineWidth = o.lw;
      g.stroke();
    } else if (o.t === 'text') {
      g.font = `${o.bold ? 'bold ' : ''}${o.size}px Arial, Helvetica, sans-serif`;
      g.fillStyle = o.color;
      g.textAlign = o.align ?? 'left';
      g.textBaseline = 'alphabetic';
      g.fillText(o.text, o.x, top + o.y);
    } else {
      try { g.drawImage(await loadImage(o.src), o.x, top + o.y, o.w, o.h); } catch { /* no logo */ }
    }
  }
}

/** All the pages in one PNG image (one below the other), at <scale> pixels per point. */
export async function invoicePng(pages: Page[], scale = 2): Promise<Blob> {
  const gap = 12;
  const w = Math.max(...pages.map((p) => p.w));
  const h = pages.reduce((a, p) => a + p.h, 0) + gap * (pages.length - 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const g = canvas.getContext('2d')!;
  g.scale(scale, scale);
  g.fillStyle = '#d0d4d9';
  g.fillRect(0, 0, w, h);
  let top = 0;
  for (const p of pages) { await drawPage(g, p, top); top += p.h + gap; }
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

// --- PDF ---------------------------------------------------------------------------------------------------------------------

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Unicode → WinAnsi (the Helvetica encoding in PDF): Latin characters work; anything else becomes "?". */
const WIN: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f, '−': 0x2d, ' ': 0x20, ' ': 0x20,
};
function winAnsiHex(s: string): string {
  let hex = '';
  for (const ch of s.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    const b = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) ? code : WIN[ch] ?? 0x3f;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
};
const f = (v: number) => (Math.round(v * 100) / 100).toString();

/** A rounded rectangle as a PDF path (Bézier curves). */
function roundRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const k = 0.5523 * r;
  return [`${f(x + r)} ${f(y)} m`, `${f(x + w - r)} ${f(y)} l`, `${f(x + w - r + k)} ${f(y)} ${f(x + w)} ${f(y + r - k)} ${f(x + w)} ${f(y + r)} c`,
    `${f(x + w)} ${f(y + h - r)} l`, `${f(x + w)} ${f(y + h - r + k)} ${f(x + w - r + k)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} c`,
    `${f(x + r)} ${f(y + h)} l`, `${f(x + r - k)} ${f(y + h)} ${f(x)} ${f(y + h - r + k)} ${f(x)} ${f(y + h - r)} c`,
    `${f(x)} ${f(y + r)} l`, `${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)} c`, 'h'].join(' ');
}

/** The invoice as PDF. */
export async function invoicePdf(pages: Page[], title: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const objects: (Uint8Array | string)[] = []; // index = object number - 1
  const add = (o: Uint8Array | string) => { objects.push(o); return objects.length; };
  const stream = (dict: string, data: Uint8Array) => {
    const head = enc.encode(`${dict.replace(/>>$/, '')} /Length ${data.length} >>\nstream\n`);
    const tail = enc.encode('\nendstream');
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head); out.set(data, head.length); out.set(tail, head.length + data.length);
    return out;
  };

  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  // The images (once each): RGB + separate transparency (SMask), compressed.
  const imageNames = new Map<string, string>();
  const imageRefs: string[] = [];
  for (const src of new Set(pages.flatMap((p) => p.ops.filter((o): o is Extract<Op, { t: 'img' }> => o.t === 'img').map((o) => o.src)))) {
    try {
      const img = await loadImage(src);
      const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h).data;
      const color = new Uint8Array(w * h * 3), alpha = new Uint8Array(w * h);
      let transparent = false;
      for (let i = 0, j = 0, k = 0; i < px.length; i += 4, j += 3, k++) {
        color[j] = px[i]; color[j + 1] = px[i + 1]; color[j + 2] = px[i + 2]; alpha[k] = px[i + 3];
        if (px[i + 3] < 255) transparent = true;
      }
      const smask = transparent
        ? add(stream(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode >>`, await deflate(alpha)))
        : 0;
      const ref = add(stream(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask ? ` /SMask ${smask} 0 R` : ''} >>`,
        await deflate(color)));
      const name = `Im${imageNames.size + 1}`;
      imageNames.set(src, name);
      imageRefs.push(`/${name} ${ref} 0 R`);
    } catch { /* an image that could not be read is left out */ }
  }

  const kids: number[] = [];
  for (const p of pages) {
    const H = p.h;
    const cs: string[] = [];
    for (const o of p.ops) {
      if (o.t === 'rect') {
        const path = o.r ? roundRectPath(o.x, H - o.y - o.h, o.w, o.h, o.r) : `${f(o.x)} ${f(H - o.y - o.h)} ${f(o.w)} ${f(o.h)} re`;
        if (o.fill && o.stroke) cs.push(`${rgb(o.fill)} rg ${rgb(o.stroke)} RG ${f(o.lw ?? 1)} w ${path} B`);
        else if (o.fill) cs.push(`${rgb(o.fill)} rg ${path} f`);
        else if (o.stroke) cs.push(`${rgb(o.stroke)} RG ${f(o.lw ?? 1)} w ${path} S`);
      } else if (o.t === 'line') {
        cs.push(`${rgb(o.color)} RG ${f(o.lw)} w ${f(o.x1)} ${f(H - o.y1)} m ${f(o.x2)} ${f(H - o.y2)} l S`);
      } else if (o.t === 'text') {
        const width = measure(o.text, o.size, o.bold);
        const x = o.align === 'right' ? o.x - width : o.align === 'center' ? o.x - width / 2 : o.x;
        cs.push(`BT /${o.bold ? 'F2' : 'F1'} ${f(o.size)} Tf ${rgb(o.color)} rg ${f(x)} ${f(H - o.y)} Td <${winAnsiHex(o.text)}> Tj ET`);
      } else {
        const name = imageNames.get(o.src);
        if (name) cs.push(`q ${f(o.w)} 0 0 ${f(o.h)} ${f(o.x)} ${f(H - o.y - o.h)} cm /${name} Do Q`);
      }
    }
    const content = add(stream('<< /Filter /FlateDecode >>', await deflate(enc.encode(cs.join('\n')))));
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${f(p.w)} ${f(H)}] /Contents ${content} 0 R ` +
      `/Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >>${imageRefs.length ? ` /XObject << ${imageRefs.join(' ')} >>` : ''} >> >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title <FEFF${[...title].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')}> /Producer (Docodez) >>`);

  // Build the file with the offset table (xref).
  const chunks: Uint8Array[] = [enc.encode('%PDF-1.4\n%âãÏÓ\n')];
  let offset = chunks[0].length;
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(offset);
    const body = typeof o === 'string' ? enc.encode(o) : o;
    const head = enc.encode(`${i + 1} 0 obj\n`);
    const tail = enc.encode('\nendobj\n');
    chunks.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}` +
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(enc.encode(xref));
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}
