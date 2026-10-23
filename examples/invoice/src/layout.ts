// El diseño de la factura: arma cada página como una lista de dibujos (rectángulos, líneas, textos, el logo) en puntos (1/72
// de pulgada, como un PDF). Lo mismo se dibuja en SVG (vista previa, página web), en un canvas (imagen) y en el PDF: la
// factura sale igual en los tres. Las medidas de los textos son las de Arial, que tiene los mismos anchos que Helvetica
// (la letra del PDF).
import type { DocTexts } from './i18n';
import type { Column, Invoice, Totals } from './model';
import { itemAmount, parseNum, taxIdLabelFor } from './model';

export type Align = 'left' | 'right' | 'center';
export type Op =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; r?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { t: 'text'; x: number; y: number; size: number; text: string; bold?: boolean; color: string; align?: Align }
  | { t: 'img'; x: number; y: number; w: number; h: number; src: string };
export interface Page { w: number; h: number; ops: Op[] }

export const PAGE_SIZES = { letter: [612, 792], a4: [595.28, 841.89] } as const;

let ctx: CanvasRenderingContext2D | null = null;
/** El ancho de un texto en puntos (Arial = Helvetica). */
export function measure(text: string, size: number, bold = false): number {
  ctx ??= document.createElement('canvas').getContext('2d')!;
  ctx.font = `${bold ? 'bold ' : ''}100px Arial, Helvetica, sans-serif`;
  return (ctx.measureText(text).width * size) / 100;
}

/** El texto cortado en renglones de hasta <width> (respeta los saltos de línea; corta palabras muy largas). */
export function wrap(text: string, size: number, width: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of String(text ?? '').split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word;
      if (measure(test, size, bold) <= width) { line = test; continue; }
      if (line) out.push(line);
      line = word;
      while (measure(line, size, bold) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), size, bold) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

/** Mezcla un color con blanco (0 = el color, 1 = blanco). */
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#f3f4f6';
  const n = parseInt(m[1], 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amount);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}

const DARK = '#1f2328';
const MUTED = '#6b7280';
const LINE = '#d8dde3';

export interface LayoutInput {
  inv: Invoice; totals: Totals; doc: DocTexts; money: (v: number) => string; dateText: (d: string) => string;
  /** Ancho / alto del logo (para que no se deforme), o null sin logo. */
  logoAspect: number | null;
  /** Fase 12a: en la versión gratis de Docodez, "Hecho con Docodez" en el pie de cada página. */
  madeWith?: string;
}

export function layoutInvoice(input: LayoutInput): Page[] {
  const { inv, totals, doc, money, dateText } = input;
  const [W, H] = PAGE_SIZES[inv.pageSize];
  const M = 42;
  const accent = /^#[0-9a-f]{6}$/i.test(inv.accent) ? inv.accent : '#1f6feb';
  const tpl = inv.template;
  const pages: Page[] = [];
  let ops: Op[] = [];
  let y = 0;
  const left = tpl === 'bold' ? M + 14 : M;
  const right = W - M;
  const width = right - left;
  const bottom = H - M - 18;

  const newPage = () => {
    ops = [];
    pages.push({ w: W, h: H, ops });
    if (tpl === 'bold') ops.push({ t: 'rect', x: 0, y: 0, w: 16, h: H, fill: accent });
    if (tpl === 'modern') ops.push({ t: 'rect', x: 0, y: H - 8, w: W, h: 8, fill: accent });
    y = M;
  };
  const text = (x: number, yy: number, size: number, s: string, opts: { bold?: boolean; color?: string; align?: Align } = {}) =>
    ops.push({ t: 'text', x, y: yy, size, text: s, bold: opts.bold, color: opts.color ?? DARK, align: opts.align });
  /** Varios renglones desde <top>; devuelve el alto usado. */
  const lines = (x: number, top: number, rows: string[], size: number, opts: { bold?: boolean; color?: string; align?: Align } = {}) => {
    const lh = size * 1.32;
    rows.forEach((r, i) => text(x, top + size * 0.82 + i * lh, size, r, opts));
    return rows.length * lh;
  };
  const logo = (x: number, top: number, maxW: number, maxH: number, align: Align = 'left') => {
    if (!inv.from.logo || !input.logoAspect) return { w: 0, h: 0 };
    let w = maxW, h = maxW / input.logoAspect;
    if (h > maxH) { h = maxH; w = maxH * input.logoAspect; }
    const lx = align === 'right' ? x - w : x;
    ops.push({ t: 'img', x: lx, y: top, w, h, src: inv.from.logo });
    return { w, h };
  };

  // --- el negocio y el cliente --------------------------------------------------------------------------------------------
  const b = inv.from;
  const businessRows = (maxW: number) => [
    ...wrap(b.address, 9, maxW),
    ...[b.phone, b.email, b.website].filter((x) => x.trim()).map((x) => x.trim()),
    ...b.taxIds.filter((x) => x.number.trim()).map((x) => `${x.label.trim() || taxIdLabelFor(b.country, inv.language)}: ${x.number.trim()}`),
  ];
  const c = inv.to;
  const clientRows = (maxW: number) => [
    ...(c.company.trim() && c.name.trim() ? [c.company.trim()] : []),
    ...wrap(c.address, 9.5, maxW), ...[c.email, c.phone].filter((x) => x.trim()).map((x) => x.trim()),
    ...(c.taxId.trim() ? [`${taxIdLabelFor(b.country, inv.language)}: ${c.taxId.trim()}`] : []),
  ];
  const clientTitle = c.name.trim() || c.company.trim();
  const meta: [string, string][] = [
    [doc.number, inv.number], [doc.date, dateText(inv.date)],
    ...(inv.dueDate ? [[doc.due[inv.kind], dateText(inv.dueDate)] as [string, string]] : []),
  ];
  const metaBlock = (xRight: number, top: number, color = DARK, labelColor = MUTED) => {
    meta.forEach(([k, v], i) => {
      const yy = top + 10 + i * 14;
      text(xRight, yy, 9.5, v, { bold: true, color, align: 'right' });
      text(xRight - measure(v, 9.5, true) - 8, yy, 9, k, { color: labelColor, align: 'right' });
    });
    return meta.length * 14 + 4;
  };
  const toBlock = (x: number, top: number, maxW: number) => {
    text(x, top + 8, 8.5, doc.to[inv.kind].toUpperCase(), { bold: true, color: tpl === 'minimal' ? MUTED : accent });
    let h = 14;
    if (clientTitle) h += lines(x, top + h, wrap(clientTitle, 11, maxW, true), 11, { bold: true });
    h += lines(x, top + h + 1, clientRows(maxW), 9.5, { color: DARK }) + 1;
    return h;
  };
  const paidStamp = (xRight: number, top: number) => {
    if (inv.status !== 'paid' || inv.kind === 'quote') return;
    const s = doc.paidStamp;
    const w = measure(s, 13, true) + 18;
    ops.push({ t: 'rect', x: xRight - w, y: top, w, h: 22, stroke: '#2e7d32', lw: 1.6, r: 4 });
    text(xRight - w / 2, top + 15.5, 13, s, { bold: true, color: '#2e7d32', align: 'center' });
  };

  newPage();
  const title = doc.title[inv.kind];
  if (tpl === 'modern') {
    const bandH = 118;
    ops.push({ t: 'rect', x: 0, y: 0, w: W, h: bandH, fill: accent });
    let x = left;
    if (b.logo && input.logoAspect) {
      const lw = Math.min(110, 64 * input.logoAspect);
      const lh = lw / input.logoAspect;
      ops.push({ t: 'rect', x, y: 26, w: lw + 12, h: lh + 12, fill: '#ffffff', r: 6 });
      logo(x + 6, 32, lw, lh);
      x += lw + 26;
    }
    text(x, 46, 17, b.name.trim(), { bold: true, color: '#ffffff' });
    lines(x, 54, businessRows(260).slice(0, 4), 8.5, { color: tint(accent, 0.82) });
    text(right, 52, 26, title, { bold: true, color: '#ffffff', align: 'right' });
    text(right, 72, 10, `${doc.number} ${inv.number}`, { color: '#ffffff', align: 'right' });
    y = bandH + 24;
    const hTo = toBlock(left, y, width * 0.55);
    const hMeta = metaBlock(right, y);
    paidStamp(right, y + hMeta + 4);
    y += Math.max(hTo, hMeta + 30) + 14;
  } else if (tpl === 'minimal') {
    let hl = 0;
    const lg = logo(right, y, 120, 46, 'right');
    hl = lg.h;
    text(left, y + 14, 13, b.name.trim(), { bold: true });
    const hb = 18 + lines(left, y + 18, businessRows(width * 0.55), 9, { color: MUTED });
    y += Math.max(hl, hb) + 22;
    text(left, y + 16, 20, title.split('').join(' '), { color: accent });
    y += 30;
    ops.push({ t: 'line', x1: left, y1: y, x2: right, y2: y, color: LINE, lw: 0.7 });
    y += 12;
    const hTo = toBlock(left, y, width * 0.55);
    const hMeta = metaBlock(right, y);
    paidStamp(right, y + hMeta + 4);
    y += Math.max(hTo, hMeta + 30) + 12;
  } else {
    // clásica y llamativa: el logo y el negocio a la izquierda; el título a la derecha
    const lg = logo(left, y, 160, 64);
    let hb = lg.h ? lg.h + 8 : 0;
    hb += lines(left, y + hb, wrap(b.name.trim(), 13, width * 0.55, true), 13, { bold: true });
    hb += lines(left, y + hb + 2, businessRows(width * 0.55), 9, { color: MUTED }) + 2;
    const tSize = tpl === 'bold' ? 34 : 24;
    text(right, y + tSize * 0.85, tSize, title, { bold: true, color: accent, align: 'right' });
    const hMeta = metaBlock(right, y + tSize + 6);
    paidStamp(right, y + tSize + hMeta + 12);
    y += Math.max(hb, tSize + hMeta + 40) + 14;
    if (tpl === 'classic') { ops.push({ t: 'line', x1: left, y1: y - 6, x2: right, y2: y - 6, color: accent, lw: 1.5 }); }
    y += 6;
    y += toBlock(left, y, width * 0.6) + 14;
  }

  // --- la tabla ------------------------------------------------------------------------------------------------------------
  const cols = inv.columns;
  const cellText = (col: Column, raw: string, amount: number | null): string => {
    if (col.kind === 'amount') return amount == null ? '' : money(amount);
    if (col.kind === 'price') { const v = parseNum(raw); return v == null ? raw : money(v); }
    if (col.kind === 'discount') { const v = parseNum(raw); return v == null ? '' : `${v.toLocaleString(inv.language)}%`; }
    if (col.kind === 'qty') { const v = parseNum(raw); return v == null ? raw : v.toLocaleString(inv.language, { maximumFractionDigits: 3 }); }
    if (col.kind === 'date') return raw ? dateText(raw) : '';
    return raw;
  };
  const header = (col: Column) => (col.label.trim() || doc.columns[col.kind]);
  const rows = inv.items.map((item) => {
    const amount = itemAmount(inv, item);
    return cols.map((col) => cellText(col, item.cells[col.id] ?? '', amount));
  }).filter((r) => r.some((x) => x.trim()));
  const isNum = (col: Column) => col.kind !== 'text';
  const pad = 6;
  const widths = cols.map((col, i) => isNum(col)
    ? Math.max(42, measure(header(col), 8.5, true), ...rows.map((r) => measure(r[i], 9.5))) + pad * 2
    : 0);
  const textCols = cols.filter((col) => !isNum(col)).length;
  let rest = width - widths.reduce((a, w) => a + w, 0);
  if (textCols && rest < 110 * textCols) {
    // Mucho número: se achican los números (los textos se quedan con al menos 110 pt).
    const numTotal = widths.reduce((a, w) => a + w, 0);
    const scale = Math.max(0.5, (width - 110 * textCols) / numTotal);
    for (let i = 0; i < widths.length; i++) widths[i] *= scale;
    rest = width - widths.reduce((a, w) => a + w, 0);
  }
  cols.forEach((col, i) => { if (!isNum(col)) widths[i] = textCols ? rest / textCols : 0; });
  if (!textCols) { const k = width / widths.reduce((a, w) => a + w, 0); widths.forEach((_, i) => (widths[i] *= k)); }
  const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, w) => a + w, 0));

  const headFill = tpl === 'modern' ? accent : tpl === 'bold' ? '#111827' : tpl === 'classic' ? tint(accent, 0.88) : '';
  const headColor = tpl === 'modern' || tpl === 'bold' ? '#ffffff' : tpl === 'minimal' ? MUTED : DARK;
  const tableHeader = () => {
    const h = 22;
    if (headFill) ops.push({ t: 'rect', x: left, y, w: width, h, fill: headFill });
    else ops.push({ t: 'line', x1: left, y1: y + h, x2: right, y2: y + h, color: DARK, lw: 0.8 });
    cols.forEach((col, i) => {
      const label = tpl === 'minimal' ? header(col).toUpperCase() : header(col);
      const align: Align = isNum(col) ? 'right' : 'left';
      text(align === 'right' ? xs[i] + widths[i] - pad : xs[i] + pad, y + 14.5, 8.5, label, { bold: true, color: headColor, align });
    });
    y += h;
  };
  tableHeader();
  rows.forEach((r, ri) => {
    const wrapped = r.map((cell, i) => (isNum(cols[i]) ? [cell] : wrap(cell, 9.5, widths[i] - pad * 2)));
    const h = Math.max(...wrapped.map((w) => w.length)) * 12.5 + 9;
    if (y + h > bottom) { newPage(); tableHeader(); }
    if (tpl === 'modern' && ri % 2 === 1) ops.push({ t: 'rect', x: left, y, w: width, h, fill: tint(accent, 0.93) });
    wrapped.forEach((cellLines, i) => {
      const align: Align = isNum(cols[i]) ? 'right' : 'left';
      lines(align === 'right' ? xs[i] + widths[i] - pad : xs[i] + pad, y + 5, cellLines, 9.5, { align, bold: cols[i].kind === 'amount' && tpl === 'bold' });
    });
    y += h;
    ops.push({ t: 'line', x1: left, y1: y, x2: right, y2: y, color: LINE, lw: 0.5 });
  });

  // --- los totales ---------------------------------------------------------------------------------------------------------
  const pct = (v: number) => `${v.toLocaleString(inv.language, { maximumFractionDigits: 3 })}%`;
  const totalRows: [string, string][] = [[doc.subtotal, money(totals.subtotal)]];
  if (totals.discount > 0) totalRows.push([inv.discount.type === 'percent' ? `${doc.discount} (${pct(inv.discount.value ?? 0)})` : doc.discount, '−' + money(totals.discount)]);
  for (const { tax, amount } of totals.taxes) totalRows.push([`${tax.name || 'Tax'} (${pct(tax.rate)})`, money(amount)]);
  const showPaid = totals.paid > 0 && inv.kind !== 'quote';
  const boxW = Math.min(260, width * 0.5);
  const boxX = right - boxW;
  const totalsH = totalRows.length * 16 + 34 + (showPaid ? 34 : 0);
  if (y + 14 + totalsH > bottom) newPage();
  y += 12;
  for (const [k, v] of totalRows) {
    text(boxX + 4, y + 10, 9.5, k, { color: MUTED });
    text(right - pad, y + 10, 9.5, v, { align: 'right' });
    y += 16;
  }
  y += 4;
  const totalText = money(totals.total);
  if (tpl === 'modern' || tpl === 'bold') {
    ops.push({ t: 'rect', x: boxX, y, w: boxW, h: 28, fill: accent, r: tpl === 'modern' ? 4 : 0 });
    text(boxX + 10, y + 18.5, 11, doc.total.toUpperCase(), { bold: true, color: '#ffffff' });
    text(right - 10, y + 19, 14, totalText, { bold: true, color: '#ffffff', align: 'right' });
  } else {
    ops.push({ t: 'line', x1: boxX, y1: y, x2: right, y2: y, color: tpl === 'classic' ? DARK : LINE, lw: tpl === 'classic' ? 1 : 0.7 });
    text(boxX + 4, y + 19, 11, doc.total, { bold: true });
    text(right - pad, y + 19.5, 15, totalText, { bold: true, color: tpl === 'minimal' ? accent : DARK, align: 'right' });
  }
  y += 34;
  if (showPaid) {
    text(boxX + 4, y + 8, 9.5, doc.paid, { color: MUTED });
    text(right - pad, y + 8, 9.5, money(totals.paid), { align: 'right' });
    text(boxX + 4, y + 25, 10.5, doc.balance, { bold: true });
    text(right - pad, y + 25, 11, money(totals.balance), { bold: true, align: 'right' });
    y += 34;
  }

  // --- notas y condiciones -------------------------------------------------------------------------------------------------
  for (const [label, body] of [[doc.notes, inv.notes], [doc.terms, inv.terms]] as const) {
    if (!body.trim()) continue;
    const rowsN = wrap(body.trim(), 9, width);
    let first = true;
    y += 12;
    for (let i = 0; i < rowsN.length; i++) {
      if (first) {
        if (y + 30 > bottom) newPage();
        text(left, y + 8, 8.5, label.toUpperCase(), { bold: true, color: tpl === 'minimal' ? MUTED : accent });
        y += 14;
        first = false;
      }
      if (y + 12 > bottom) newPage();
      text(left, y + 8, 9, rowsN[i], { color: DARK });
      y += 12;
    }
  }

  // --- pie: página x de n, y "Hecho con Docodez" en la versión gratis ---------------------------------------------------------
  if (input.madeWith) {
    for (const p of pages) p.ops.push({ t: 'text', x: W / 2, y: H - 14, size: 7.5, text: input.madeWith, color: '#9aa0a6', align: 'center' });
  }
  if (pages.length > 1) {
    pages.forEach((p, i) => p.ops.push({ t: 'text', x: W / 2, y: H - M + 14, size: 8, text: `${inv.number} · ${doc.page(i + 1, pages.length)}`, color: MUTED, align: 'center' }));
  }
  return pages;
}
