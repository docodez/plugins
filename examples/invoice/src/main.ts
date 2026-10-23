// Invoice - Docodez plugin (see doc/04-plugins.md and README.md). TypeScript, built with Vite.
// - The INVOICE goes in the node (docodez.getJSON / setJSON), with a copy of the business data (if that changes later, an
//   old invoice stays the same).
// - The BUSINESS (name, logo, address, tax numbers, taxes, numbering, clients, previously invoiced items) goes in the
//   app data (docodez.getAppJSON / setAppJSON): the same for every invoice.
// - Sharing (API 3: docodez.shareFile) as PDF, image or web page: on Android, through the system share sheet (WhatsApp,
//   SMS, email...); on desktop, it is saved.
import type { DocodezContext } from '../../../sdk/docodez';
import { installDevDocodez } from '../../../sdk/docodez-dev';
import { createColorPicker, createPicker } from '../../../sdk/picker';
import { DOC, TEXTS } from './i18n';
import { type Page, layoutInvoice } from './layout';
import {
  type Client, type Column, type ColumnKind, type DocKind, type Invoice, type Lang, type Profile, type Status, type TemplateId,
  COUNTRIES, CURRENCIES, addDays, countryOf, guessCountry, itemAmount, moneyFormat, newId, newInvoice, normalizeInvoice, normalizeProfile,
  parseNum, rememberClient, rememberItems, taxIdLabelFor, today, totals,
} from './model';
import { invoiceHtml, invoicePdf, invoicePng, loadImage, pageSvg } from './render';
import './style.css';

if (import.meta.env.DEV) installDevDocodez('lynza.invoice');

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const button = (cls: string, text: string, onclick: () => void) => {
  const b = el('button', cls, text) as HTMLButtonElement;
  b.type = 'button';
  b.onclick = onclick;
  return b;
};

const ctx: DocodezContext = await docodez.ready;
const lang: Lang = (['es', 'en', 'fr'] as const).includes(ctx.language) ? ctx.language : 'en';
const t = TEXTS[lang];
let editable = ctx.editable;
const hasAppData = typeof docodez.getAppJSON === 'function';
const country0 = guessCountry(navigator.language, lang);

let profile: Profile = normalizeProfile(hasAppData ? await docodez.getAppJSON().catch(() => null) : null, country0);
const stored = await docodez.getJSON().catch(() => null);
let inv: Invoice = normalizeInvoice(stored, lang, profile.business.country);
let isNew = stored == null;
if (isNew) inv = newInvoice(profile, lang);

const countryName = (code: string) => {
  if (code === 'ZZ') return lang === 'es' ? 'Otro' : lang === 'fr' ? 'Autre' : 'Other';
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code; } catch { return code; }
};

// --- saving --------------------------------------------------------------------------------------------------------------
let saveTimer = 0;
let storeTimer = 0;
function scheduleSave(): void {
  if (!editable) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 400);
}
async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!editable) return;
  try {
    // The first time it is saved, the number is used up.
    if (isNew) { isNew = false; profile.nextNumber++; saveStore(); }
    await docodez.setJSON(inv);
    await docodez.setPreview(nodePreview());
    // Keep the invoiced items to suggest them later (only saved if they changed).
    const before = JSON.stringify(profile.items);
    rememberItems(profile, inv);
    if (JSON.stringify(profile.items) !== before) saveStore();
  } catch (e) {
    toast(t.saveError + (e as Error).message);
  }
}
function saveStore(): void {
  clearTimeout(storeTimer);
  storeTimer = window.setTimeout(saveStoreNow, 300);
}
async function saveStoreNow(): Promise<void> {
  clearTimeout(storeTimer);
  storeTimer = 0;
  if (!hasAppData) return;
  try { await docodez.setAppJSON(profile); } catch (e) { toast(t.saveError + (e as Error).message); }
}
/** Something changed in the invoice: save and redraw the preview (without rebuilding the editor, so focus is kept). */
function changed(): void {
  scheduleSave();
  schedulePreview();
  updateTotals();
}

// --- notices ---------------------------------------------------------------------------------------------------------------
let toastTimer = 0;
function toast(text: string): void {
  const box = $('toast');
  box.textContent = text;
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove('on'), 3000);
}
let modalClose: (() => void) | null = null;
function confirmBox(text: string, okText = t.ok): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = $('modal');
    modal.innerHTML = '';
    const box = el('div', 'modal-box');
    box.appendChild(el('p', '', text));
    const row = el('div', 'modal-buttons');
    const finish = (v: boolean) => { modal.hidden = true; modal.innerHTML = ''; modalClose = null; resolve(v); };
    row.append(button('btn', t.cancel, () => finish(false)), button('btn primary', okText, () => finish(true)));
    box.appendChild(row);
    modal.appendChild(box);
    modal.hidden = false;
    modalClose = () => finish(false);
  });
}

// --- fields ------------------------------------------------------------------------------------------------------------------
function field(parent: HTMLElement, label: string, control: HTMLElement, cls = ''): HTMLElement {
  const f = el(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? 'label' : 'div', 'field ' + cls);
  f.appendChild(el('span', '', label));
  f.appendChild(control);
  parent.appendChild(f);
  return f;
}
function input(value: string, set: (v: string) => void, opts: { placeholder?: string; mode?: string; cls?: string } = {}): HTMLInputElement {
  const i = el('input', opts.cls) as HTMLInputElement;
  i.value = value;
  i.autocomplete = 'off';
  i.spellcheck = false;
  i.disabled = !editable;
  if (opts.placeholder) i.placeholder = opts.placeholder;
  if (opts.mode) i.inputMode = opts.mode;
  i.addEventListener('input', () => set(i.value));
  return i;
}
function area(value: string, set: (v: string) => void, rows = 3, placeholder = ''): HTMLTextAreaElement {
  const a = el('textarea') as HTMLTextAreaElement;
  a.value = value;
  a.rows = rows;
  a.disabled = !editable;
  a.placeholder = placeholder;
  a.addEventListener('input', () => set(a.value));
  return a;
}
function chips<T extends string>(choices: [T, string][], current: T, pick: (v: T) => void): HTMLElement {
  const group = el('div', 'choices');
  for (const [value, label] of choices) {
    const b = button('choice' + (value === current ? ' on' : ''), label, () => {
      pick(value);
      group.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === b));
    });
    b.disabled = !editable;
    group.appendChild(b);
  }
  return group;
}
/** Suggestions drawn in the page below a field (not <datalist>: its native popup shows up in the wrong place). */
function suggest(target: HTMLInputElement, items: () => { label: string; pick: () => void }[]): void {
  const host = el('div', 'suggest-host');
  target.replaceWith(host);
  host.appendChild(target);
  const list = el('div', 'suggest');
  list.hidden = true;
  host.appendChild(list);
  const show = () => {
    const q = target.value.trim().toLowerCase();
    const shown = items().filter((x) => !q || x.label.toLowerCase().includes(q)).filter((x) => x.label.toLowerCase() !== q).slice(0, 12);
    list.innerHTML = '';
    for (const s of shown) {
      const item = el('div', 'suggest-item', s.label);
      item.addEventListener('pointerdown', (e) => { e.preventDefault(); list.hidden = true; s.pick(); });
      list.appendChild(item);
    }
    list.hidden = !shown.length || document.activeElement !== target;
  };
  target.addEventListener('focus', show);
  target.addEventListener('input', show);
  target.addEventListener('blur', () => { list.hidden = true; });
}
function card(parent: HTMLElement, title: string): HTMLElement {
  const c = el('section', 'card');
  c.appendChild(el('h3', '', title));
  parent.appendChild(c);
  return c;
}

// --- the editor ---------------------------------------------------------------------------------------------------------------
const colLabel = (c: Column) => c.label.trim() || DOC[inv.language].columns[c.kind];
let totalsBox: HTMLElement | null = null;
const amountCells = new Map<string, HTMLElement>();

function renderEditor(): void {
  const box = $('editor');
  const scroll = box.scrollTop;
  box.innerHTML = '';
  amountCells.clear();

  // ---- the invoice ----
  const head = card(box, t.kinds[inv.kind]);
  head.appendChild(chips<DocKind>([['invoice', t.kinds.invoice], ['quote', t.kinds.quote], ['receipt', t.kinds.receipt]], inv.kind,
    (v) => { inv.kind = v; changed(); renderBar(); head.querySelector('h3')!.textContent = t.kinds[v]; }));
  const g1 = el('div', 'grid');
  head.appendChild(g1);
  field(g1, t.number, input(inv.number, (v) => { inv.number = v.trim(); changed(); renderBar(); }));
  field(g1, t.date, dateInput(inv.date, (v) => { inv.date = v; changed(); }));
  const due = dateInput(inv.dueDate, (v) => { inv.dueDate = v; changed(); });
  const dueWrap = el('div', 'row');
  dueWrap.appendChild(due);
  if (editable) for (const n of [15, 30]) dueWrap.appendChild(button('btn small', t.days(n), () => { inv.dueDate = addDays(inv.date || today(), n); due.value = inv.dueDate; changed(); }));
  field(g1, t.dueDate, dueWrap);
  field(head, t.status, chips<Status>([['draft', t.statuses.draft], ['sent', t.statuses.sent], ['paid', t.statuses.paid]], inv.status,
    (v) => { inv.status = v; changed(); }));
  const g2 = el('div', 'grid');
  head.appendChild(g2);
  field(g2, t.docLanguage, chips<Lang>([['es', 'Español'], ['en', 'English'], ['fr', 'Français']], inv.language, (v) => { inv.language = v; changed(); renderEditor(); }));
  const curHost = el('div');
  const cur = createPicker(curHost, t.currency);
  cur.set(CURRENCIES, inv.currency);
  cur.onchange = (v) => { inv.currency = v; profile.currency = v; saveStore(); changed(); };
  if (!editable) (curHost.querySelector('button') as HTMLButtonElement).disabled = true;
  field(g2, t.currency, curHost);

  // ---- the client ----
  const cl = card(box, t.client);
  const g3 = el('div', 'grid');
  cl.appendChild(g3);
  const name = input(inv.to.name, (v) => { inv.to.name = v; changed(); });
  field(g3, t.clientName, name);
  if (editable) {
    suggest(name, () => profile.clients.map((c) => ({
      label: [c.name, c.company].filter(Boolean).join(' · '),
      pick: () => { inv.to = structuredClone(c); changed(); renderEditor(); },
    })));
  }
  field(g3, t.company, input(inv.to.company, (v) => { inv.to.company = v; changed(); }));
  field(g3, t.email, input(inv.to.email, (v) => { inv.to.email = v; changed(); }, { mode: 'email' }));
  field(g3, t.phone, input(inv.to.phone, (v) => { inv.to.phone = v; changed(); }, { mode: 'tel' }));
  field(cl, t.address, area(inv.to.address, (v) => { inv.to.address = v; changed(); }, 2));
  field(cl, t.clientTaxId, input(inv.to.taxId, (v) => { inv.to.taxId = v; changed(); }));
  if (editable) cl.appendChild(button('btn small', t.saveClient, () => { rememberClient(profile, inv.to); saveStore(); toast(t.clientSaved); }));

  // ---- the items ----
  const it = card(box, t.items);
  const table = el('div', 'items');
  it.appendChild(table);
  const hasTaxes = inv.taxes.length > 0;
  const headRow = el('div', 'item head');
  for (const c of inv.columns) headRow.appendChild(el('span', 'cell ' + cellClass(c), colLabel(c)));
  if (hasTaxes) headRow.appendChild(el('span', 'cell tx', '%'));
  headRow.appendChild(el('span', 'cell x'));
  table.appendChild(headRow);
  for (const item of inv.items) {
    const row = el('div', 'item');
    for (const c of inv.columns) {
      const cell = el('div', 'cell ' + cellClass(c));
      cell.dataset.label = colLabel(c);
      if (c.kind === 'amount' && inv.columns.some((x) => x.kind === 'price')) {
        const out = el('output', 'amount');
        amountCells.set(item.id, out);
        cell.appendChild(out);
      } else {
        const i = input(item.cells[c.id] ?? '', (v) => { item.cells[c.id] = v; changed(); },
          { placeholder: colLabel(c), mode: c.kind === 'text' ? undefined : c.kind === 'date' ? 'numeric' : 'decimal' });
        cell.appendChild(i);
        if (c.kind === 'text' && editable) {
          suggest(i, () => profile.items.map((x) => ({
            label: x.price ? `${x.text} · ${x.price}` : x.text,
            pick: () => {
              item.cells[c.id] = x.text;
              const price = inv.columns.find((k) => k.kind === 'price');
              if (price && x.price && !item.cells[price.id]) item.cells[price.id] = x.price;
              changed();
              renderEditor();
            },
          })));
        }
      }
      row.appendChild(cell);
    }
    if (hasTaxes) {
      const tx = el('label', 'cell tx');
      const cb = el('input') as HTMLInputElement;
      cb.type = 'checkbox';
      cb.checked = item.taxable;
      cb.disabled = !editable;
      cb.title = t.taxable;
      cb.onchange = () => { item.taxable = cb.checked; changed(); };
      tx.appendChild(cb);
      row.appendChild(tx);
    }
    const x = button('cell x icon-btn', '✕', () => { inv.items = inv.items.filter((y) => y !== item); changed(); renderEditor(); });
    x.title = t.removeItem;
    x.disabled = !editable;
    row.appendChild(x);
    table.appendChild(row);
  }
  if (editable) {
    const actions = el('div', 'row');
    actions.append(
      button('btn', t.addItem, () => { inv.items.push({ id: newId(), cells: {}, taxable: true }); changed(); renderEditor(); focusLast(); }),
      button('btn', t.columns, editColumns));
    it.appendChild(actions);
  }

  // ---- taxes and totals ----
  const tc = card(box, t.taxes);
  for (const tax of inv.taxes) {
    const row = el('div', 'row tax');
    row.append(input(tax.name, (v) => { tax.name = v; changed(); }, { placeholder: t.taxName }),
      input(String(tax.rate || ''), (v) => { tax.rate = parseNum(v) ?? 0; changed(); }, { placeholder: t.taxRate, mode: 'decimal', cls: 'rate' }),
      el('span', 'muted', '%'));
    if (editable) row.appendChild(button('icon-btn', '✕', () => { inv.taxes = inv.taxes.filter((x) => x !== tax); changed(); renderEditor(); }));
    tc.appendChild(row);
  }
  if (editable) {
    const presets = countryOf(inv.from.country || profile.business.country).taxes;
    const row = el('div', 'choices');
    row.appendChild(button('choice', t.addTax, () => { inv.taxes.push({ id: newId(), name: '', rate: 0 }); changed(); renderEditor(); }));
    for (const [n, r] of presets) row.appendChild(button('choice', `${n} ${r}%`, () => { inv.taxes.push({ id: newId(), name: n, rate: r }); changed(); renderEditor(); }));
    tc.appendChild(row);
  }
  const g4 = el('div', 'grid');
  tc.appendChild(g4);
  const disc = el('div', 'row');
  disc.append(chips<'percent' | 'amount'>([['percent', t.percent], ['amount', t.amountOff]], inv.discount.type, (v) => { inv.discount.type = v; changed(); }),
    input(inv.discount.value == null ? '' : String(inv.discount.value), (v) => { inv.discount.value = parseNum(v); changed(); }, { mode: 'decimal', cls: 'rate' }));
  field(g4, t.discount, disc);
  field(g4, t.paidAmount, input(inv.paid == null ? '' : String(inv.paid), (v) => { inv.paid = parseNum(v); changed(); }, { mode: 'decimal' }));
  totalsBox = el('div', 'totals');
  tc.appendChild(totalsBox);

  // ---- notes ----
  const nc = card(box, t.notes);
  nc.appendChild(area(inv.notes, (v) => { inv.notes = v; changed(); }, 3));
  field(nc, t.terms, area(inv.terms, (v) => { inv.terms = v; changed(); }, 2));

  // ---- look ----
  const lc = card(box, t.look);
  field(lc, t.template, chips<TemplateId>((['classic', 'modern', 'minimal', 'bold'] as TemplateId[]).map((x) => [x, t.templates[x]]), inv.template,
    (v) => { inv.template = v; profile.template = v; saveStore(); changed(); }));
  const g5 = el('div', 'row');
  const colorHost = el('div');
  createColorPicker(colorHost, t.accent, inv.accent, (c) => { inv.accent = c; profile.accent = c; saveStore(); changed(); });
  if (!editable) (colorHost.querySelector('button') as HTMLButtonElement).disabled = true;
  field(g5, t.accent, colorHost);
  field(g5, t.pageSize, chips<'letter' | 'a4'>([['letter', t.letter], ['a4', t.a4]], inv.pageSize, (v) => { inv.pageSize = v; profile.pageSize = v; saveStore(); changed(); }));
  lc.appendChild(g5);

  updateTotals();
  box.scrollTop = scroll;
}

const cellClass = (c: Column) => (c.kind === 'text' ? 'wide' : c.kind === 'date' ? 'mid' : 'num');

function focusLast(): void {
  const rows = document.querySelectorAll('#editor .item:not(.head)');
  (rows[rows.length - 1]?.querySelector('input') as HTMLInputElement | null)?.focus();
}

function dateInput(value: string, set: (v: string) => void): HTMLInputElement {
  // Not <input type=date>: its native popup shows up in the wrong place in the built-in Windows viewer (see sdk/picker.ts).
  const i = input(value, (v) => { const ok = !v.trim() || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()); i.classList.toggle('bad', !ok); if (ok) set(v.trim()); },
    { placeholder: lang === 'en' ? 'yyyy-mm-dd' : lang === 'fr' ? 'aaaa-mm-jj' : 'aaaa-mm-dd', mode: 'numeric', cls: 'date' });
  return i;
}

function updateTotals(): void {
  const money = moneyFormat(inv);
  for (const item of inv.items) {
    const out = amountCells.get(item.id);
    if (out) { const a = itemAmount(inv, item); out.textContent = a == null ? '' : money(a); }
  }
  if (!totalsBox) return;
  const tt = totals(inv);
  const rows: [string, string, string?][] = [[t.subtotal, money(tt.subtotal)]];
  if (tt.discount) rows.push([t.discount, '−' + money(tt.discount)]);
  for (const x of tt.taxes) rows.push([`${x.tax.name} (${x.tax.rate.toLocaleString(lang, { maximumFractionDigits: 3 })}%)`, money(x.amount)]);
  rows.push([t.total, money(tt.total), 'total']);
  if (tt.paid) { rows.push([t.paidAmount, money(tt.paid)]); rows.push([t.balance, money(tt.balance), 'total']); }
  totalsBox.innerHTML = rows.map(([k, v, c]) => `<div class="${c ?? ''}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
}

// --- columns -----------------------------------------------------------------------------------------------------------------
function editColumns(): void {
  const draft: Column[] = structuredClone(inv.columns);
  openSheet(t.columnsTitle, (body) => {
    body.appendChild(el('p', 'hint', t.columnsHint));
    const list = el('div', 'cols');
    body.appendChild(list);
    const render = () => {
      list.innerHTML = '';
      draft.forEach((c, i) => {
        const row = el('div', 'col-row');
        const top = el('div', 'row');
        top.appendChild(input(c.label, (v) => (c.label = v), { placeholder: DOC[inv.language].columns[c.kind] }));
        top.append(
          button('icon-btn', t.up, () => { if (i > 0) { [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; render(); } }),
          button('icon-btn', t.down, () => { if (i < draft.length - 1) { [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]]; render(); } }),
          button('icon-btn', '✕', async () => { if (await confirmBox(t.confirmRemoveColumn, t.delete)) { draft.splice(i, 1); render(); } }));
        row.appendChild(top);
        row.appendChild(chips<ColumnKind>((['text', 'qty', 'price', 'discount', 'amount', 'number', 'date'] as ColumnKind[]).map((k) => [k, t.colKinds[k]]), c.kind,
          (v) => { c.kind = v; render(); }));
        list.appendChild(row);
      });
      list.appendChild(button('btn', t.addColumn, () => { draft.push({ id: newId(), kind: 'text', label: '' }); render(); }));
    };
    render();
    body.appendChild(button('btn small', t.makeDefault, () => { profile.columns = structuredClone(draft); saveStore(); toast(t.defaultSaved); }));
  }, () => {
    if (!draft.length) return false;
    inv.columns = draft;
    changed();
    renderEditor();
  });
}

// --- my business ---------------------------------------------------------------------------------------------------------------
/** The logo: downscaled (longest side 600 px), PNG if it has transparency or is small, JPEG otherwise. */
async function logoDataUrl(data: ArrayBuffer, name: string): Promise<string> {
  const type = /\.svg$/i.test(name) ? 'image/svg+xml' : '';
  const url = URL.createObjectURL(new Blob([data], type ? { type } : {}));
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 600 / Math.max(img.naturalWidth || 600, img.naturalHeight || 600));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((img.naturalWidth || 600) * scale));
    canvas.height = Math.max(1, Math.round((img.naturalHeight || 600) * scale));
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    if (png.length < 160_000) return png;
    const px = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = false;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { transparent = true; break; }
    if (transparent) return png;
    const white = document.createElement('canvas');
    white.width = canvas.width; white.height = canvas.height;
    const w = white.getContext('2d')!;
    w.fillStyle = '#fff';
    w.fillRect(0, 0, white.width, white.height);
    w.drawImage(canvas, 0, 0);
    return white.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function editBusiness(): void {
  const b = structuredClone(profile.business);
  const p = { prefix: profile.prefix, nextNumber: profile.nextNumber, dueDays: profile.dueDays, notes: profile.notes, terms: profile.terms, currency: profile.currency };
  let taxes = structuredClone(profile.taxes);
  openSheet(t.businessTitle, (body) => {
    // logo
    const logoBox = el('div', 'logo-box');
    const renderLogo = () => {
      logoBox.innerHTML = '';
      if (b.logo) { const img = el('img') as HTMLImageElement; img.src = b.logo; logoBox.appendChild(img); }
      const pick = async (camera: boolean) => {
        try {
          const f = camera ? await docodez.capturePhoto!() : await docodez.pickFile(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);
          if (!f) return;
          b.logo = await logoDataUrl(f.data, f.name);
          renderLogo();
        } catch (e) { toast(t.shareError + (e as Error).message); }
      };
      logoBox.appendChild(button('btn small', t.logoPick, () => void pick(false)));
      if (ctx.camera && typeof docodez.capturePhoto === 'function') logoBox.appendChild(button('btn small', t.logoCamera, () => void pick(true)));
      if (b.logo) logoBox.appendChild(button('btn small', t.logoRemove, () => { b.logo = null; renderLogo(); }));
    };
    renderLogo();
    field(body, t.logo, logoBox);
    field(body, t.businessName, input(b.name, (v) => (b.name = v)));
    field(body, t.address, area(b.address, (v) => (b.address = v), 3));
    const g = el('div', 'grid');
    body.appendChild(g);
    field(g, t.phone, input(b.phone, (v) => (b.phone = v), { mode: 'tel' }));
    field(g, t.email, input(b.email, (v) => (b.email = v), { mode: 'email' }));
    field(g, t.website, input(b.website, (v) => (b.website = v)));
    // country: the name of the tax number, the currency and the suggested taxes
    const countryHost = el('div');
    const names = COUNTRIES.map((c) => [c.code, countryName(c.code)] as const).sort((x, y) => (x[0] === 'ZZ' ? 1 : y[0] === 'ZZ' ? -1 : x[1].localeCompare(y[1])));
    const picker = createPicker(countryHost, t.country);
    picker.set(names.map((n) => n[1]), countryName(b.country));
    field(g, t.country, countryHost);
    const ids = el('div', 'taxids');
    const renderIds = () => {
      ids.innerHTML = '';
      for (const id of b.taxIds) {
        const row = el('div', 'row');
        row.append(input(id.label, (v) => (id.label = v), { placeholder: taxIdLabelFor(b.country, lang), cls: 'label-in' }),
          input(id.number, (v) => (id.number = v)), button('icon-btn', '✕', () => { b.taxIds = b.taxIds.filter((x) => x !== id); renderIds(); }));
        ids.appendChild(row);
      }
      ids.appendChild(button('btn small', t.addTaxId, () => { b.taxIds.push({ label: taxIdLabelFor(b.country, lang), number: '' }); renderIds(); }));
    };
    renderIds();
    field(body, t.taxIds, ids);
    const taxBox = el('div');
    const renderTaxes = () => {
      taxBox.innerHTML = '';
      for (const tax of taxes) {
        const row = el('div', 'row tax');
        row.append(input(tax.name, (v) => (tax.name = v), { placeholder: t.taxName }),
          input(String(tax.rate || ''), (v) => (tax.rate = parseNum(v) ?? 0), { mode: 'decimal', cls: 'rate' }), el('span', 'muted', '%'),
          button('icon-btn', '✕', () => { taxes = taxes.filter((x) => x !== tax); renderTaxes(); }));
        taxBox.appendChild(row);
      }
      const presets = countryOf(b.country).taxes;
      if (presets.length) {
        taxBox.appendChild(el('div', 'hint', t.presets));
        const row = el('div', 'choices');
        for (const [n, r] of presets) row.appendChild(button('choice', `${n} ${r}%`, () => { taxes.push({ id: newId(), name: n, rate: r }); renderTaxes(); }));
        taxBox.appendChild(row);
      }
    };
    renderTaxes();
    picker.onchange = (label) => {
      const code = names.find((n) => n[1] === label)?.[0] ?? 'ZZ';
      b.country = code;
      p.currency = countryOf(code).currency;
      for (const id of b.taxIds) if (!id.number.trim()) id.label = taxIdLabelFor(code, lang);
      renderIds();
      renderTaxes();
    };
    field(body, t.defaultTaxes, taxBox);
    const g2 = el('div', 'grid');
    body.appendChild(g2);
    field(g2, t.prefix, input(p.prefix, (v) => (p.prefix = v)));
    field(g2, t.nextNumber, input(String(p.nextNumber), (v) => (p.nextNumber = Math.max(1, Math.floor(parseNum(v) ?? 1))), { mode: 'numeric' }));
    field(g2, t.dueDays, input(String(p.dueDays), (v) => (p.dueDays = Math.max(0, Math.floor(parseNum(v) ?? 0))), { mode: 'numeric' }));
    field(body, t.defaultNotes, area(p.notes, (v) => (p.notes = v), 2));
    field(body, t.defaultTerms, area(p.terms, (v) => (p.terms = v), 2));
  }, () => {
    profile.business = b;
    Object.assign(profile, p);
    profile.taxes = taxes;
    void saveStoreNow();
    // This invoice takes the new data (the others keep theirs).
    if (editable) {
      inv.from = structuredClone(b);
      // The country currency (if the country changed); not on an invoice that was already sent.
      if (inv.status === 'draft') inv.currency = profile.currency;
      if (!inv.taxes.length) inv.taxes = taxes.map((x) => ({ ...x, id: newId() }));
      if (!inv.notes) inv.notes = p.notes;
      if (!inv.terms) inv.terms = p.terms;
      changed();
      toast(t.applyToThis);
    }
    renderBanner();
    renderEditor();
  });
}

// --- the sheet (for columns and the business) ----------------------------------------------------------------------------------
let sheetOpen = false;
function openSheet(title: string, build: (body: HTMLElement) => void, save: () => boolean | void): void {
  const box = $('sheetBox');
  box.innerHTML = '';
  const head = el('div', 'sheet-head');
  head.appendChild(el('h3', '', title));
  const close = () => { $('sheet').hidden = true; box.innerHTML = ''; sheetOpen = false; };
  head.appendChild(button('icon-btn', '✕', close));
  const body = el('div', 'sheet-body');
  box.append(head, body);
  build(body);
  const foot = el('div', 'sheet-foot');
  foot.append(el('span', 'grow'), button('btn', t.cancel, close), button('btn primary', t.save, () => { if (save() !== false) close(); }));
  box.appendChild(foot);
  $('sheet').hidden = false;
  sheetOpen = true;
}

// --- the preview -------------------------------------------------------------------------------------------------------------
let previewTimer = 0;
let logoAspect: number | null = null;
let logoFor: string | null = null;

async function buildPages(): Promise<Page[]> {
  if (inv.from.logo !== logoFor) {
    logoFor = inv.from.logo;
    logoAspect = null;
    if (inv.from.logo) {
      try { const img = await loadImage(inv.from.logo); logoAspect = img.naturalWidth / Math.max(1, img.naturalHeight); } catch { logoAspect = null; }
    }
  }
  const locale = `${inv.language}-${inv.from.country && inv.from.country !== 'ZZ' ? inv.from.country : 'US'}`;
  const dateText = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m) return d;
    try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(+m[1], +m[2] - 1, +m[3])); } catch { return d; }
  };
  // Phase 12a: in Docodez Free, "Made with Docodez" in the footer (not in Pro).
  const madeWith = ctx.tier === 'free' ? DOC[inv.language].madeWith : undefined;
  return layoutInvoice({ inv, totals: totals(inv), doc: DOC[inv.language], money: moneyFormat(inv), dateText, logoAspect, madeWith });
}

function schedulePreview(): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(renderPreview, 150);
}

async function renderPreview(): Promise<void> {
  const pages = await buildPages();
  $('preview').innerHTML = pages.map((p) => `<div class="page">${pageSvg(p)}</div>`).join('');
}

// --- sharing -----------------------------------------------------------------------------------------------------------------
const fileBase = () => `${t.kinds[inv.kind]}-${inv.number || 'draft'}`.replace(/[\\/:*?"<>|\s]+/g, '-');

async function share(format: 'pdf' | 'png' | 'html'): Promise<void> {
  closeMenu();
  if (typeof docodez.shareFile !== 'function') { toast(t.noShare); return; }
  toast(t.building);
  try {
    if (editable) await saveNow();
    const pages = await buildPages();
    const tt = totals(inv);
    const money = moneyFormat(inv);
    const text = t.shareText(t.kinds[inv.kind], inv.number, money(tt.balance > 0 && tt.paid ? tt.balance : tt.total), inv.kind === 'invoice' && inv.status !== 'paid' ? inv.dueDate : '');
    const title = `${DOC[inv.language].title[inv.kind]} ${inv.number}`;
    let result: string | null;
    if (format === 'pdf') result = await docodez.shareFile(fileBase() + '.pdf', await invoicePdf(pages, title), 'application/pdf', text);
    else if (format === 'png') result = await docodez.shareFile(fileBase() + '.png', await invoicePng(pages), 'image/png', text);
    else result = await docodez.shareFile(fileBase() + '.html', invoiceHtml(pages, title, inv.language), 'text/html', text);
    if (result) toast(result === 'shared' ? t.shared : t.saved);
    // Sent: goes from draft to sent.
    if (result && inv.status === 'draft' && editable) { inv.status = 'sent'; changed(); renderEditor(); }
  } catch (e) {
    toast(t.shareError + (e as Error).message);
  }
}

function closeMenu(): void { $('shareMenu').hidden = true; }

// --- the toolbar -------------------------------------------------------------------------------------------------------------
function renderBar(): void {
  $('docTitle').textContent = `${t.kinds[inv.kind]} ${inv.number}`;
  document.title = `${t.kinds[inv.kind]} ${inv.number}`;
}

function renderBanner(): void {
  const banner = $('banner');
  banner.innerHTML = '';
  banner.hidden = !editable || !!profile.business.name.trim();
  if (banner.hidden) return;
  banner.append(el('span', '', t.welcome), button('btn small primary', t.setup, editBusiness));
}

function setView(mode: 'edit' | 'preview'): void {
  document.body.dataset.view = mode;
  $('viewEdit').classList.toggle('on', mode === 'edit');
  $('viewPreview').classList.toggle('on', mode === 'preview');
}

$('viewEdit').textContent = t.edit;
$('viewPreview').textContent = t.preview;
$('viewEdit').onclick = () => setView('edit');
$('viewPreview').onclick = () => setView('preview');
$('businessBtn').title = t.business;
$('businessBtn').setAttribute('aria-label', t.business);
$('businessBtn').onclick = editBusiness;
$('shareBtn').innerHTML = `📤 <span class="label">${esc(t.share)}</span>`;
$('shareBtn').onclick = () => { $('shareMenu').hidden = !$('shareMenu').hidden; };
$('shareMenu').append(
  button('menu-item', '📄 ' + t.pdf, () => void share('pdf')),
  button('menu-item', '🖼️ ' + t.image, () => void share('png')),
  button('menu-item', '🌐 ' + t.web, () => void share('html')),
  el('div', 'menu-note', ctx.share === 'share' ? t.shareHint : ''));
document.addEventListener('pointerdown', (e) => {
  if (!$('shareMenu').hidden && !(e.target as HTMLElement).closest('.menu-host')) closeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (modalClose) modalClose();
  else if (sheetOpen) ($('sheetBox').querySelector('.sheet-head .icon-btn') as HTMLButtonElement).click();
  else closeMenu();
});
$('viewNote').textContent = t.viewMode;

// --- fallback page (search, readers without the plugin) ------------------------------------------------------------------
function nodePreview(): string {
  const money = moneyFormat(inv);
  const tt = totals(inv);
  const desc = inv.columns.find((c) => c.kind === 'text');
  const qty = inv.columns.find((c) => c.kind === 'qty');
  const rows = inv.items.map((item) => {
    const a = itemAmount(inv, item);
    return `<tr><td>${esc(desc ? item.cells[desc.id] : '')}</td><td>${esc(qty ? item.cells[qty.id] : '')}</td><td style="text-align:right">${a == null ? '' : esc(money(a))}</td></tr>`;
  }).join('');
  const client: Client = inv.to;
  return `<h2>${esc(DOC[inv.language].title[inv.kind])} ${esc(inv.number)}</h2>` +
    `<p><b>${esc(inv.from.name)}</b> → <b>${esc(client.name || client.company)}</b>${client.company && client.name ? ' · ' + esc(client.company) : ''}<br>` +
    `${esc(inv.date)}${inv.dueDate ? ' · ' + esc(DOC[inv.language].due[inv.kind]) + ' ' + esc(inv.dueDate) : ''} · ${esc(t.statuses[inv.status])}</p>` +
    `<table><tbody>${rows}</tbody></table>` +
    `<p>${esc(t.subtotal)}: ${esc(money(tt.subtotal))}${tt.taxes.map((x) => ` · ${esc(x.tax.name)} ${esc(money(x.amount))}`).join('')} · <b>${esc(t.total)}: ${esc(money(tt.total))}</b></p>` +
    (inv.notes ? `<p>${esc(inv.notes)}</p>` : '');
}

// --- mode and theme ------------------------------------------------------------------------------------------------------------
function setEditable(value: boolean): void {
  editable = value;
  document.body.classList.toggle('editable', value);
  $('viewNote').hidden = value;
  renderBanner();
  renderEditor();
}
docodez.on('modechange', (p) => setEditable(p.editable));
docodez.on('themechange', (p) => document.body.classList.toggle('dark', p.theme === 'dark'));
docodez.on('appdatachange', async () => {
  if (storeTimer) return;
  profile = normalizeProfile(await docodez.getAppJSON().catch(() => null), country0);
  renderBanner();
});

document.documentElement.lang = lang;
document.body.classList.toggle('dark', ctx.theme === 'dark');
setView(matchMedia('(min-width: 900px)').matches ? 'edit' : isNew ? 'edit' : 'preview');
renderBar();
setEditable(editable);
void renderPreview();
// A new invoice is saved right away (with its number).
if (isNew && editable) void saveNow();

// For automated tests.
(window as unknown as Record<string, unknown>).__invoice = {
  get inv() { return inv; }, get profile() { return profile; }, buildPages, share, editBusiness, editColumns, renderEditor, saveNow, nodePreview,
  invoicePdf, invoicePng, invoiceHtml,
};
