// Bitácora del carro - plugin de Docodez (ver doc/04-plugins.md y README.md). TypeScript, compilado con Vite.
// - Todo va en el nodo (docodez.getJSON / setJSON): el carro, la gasolina, las reparaciones, los accesorios, los viajes y
//   las notas. Fotos, facturas y archivos, como anexos del nodo.
// - Los datos de la APP solo guardan las unidades preferidas (para el próximo carro).
// - API 3 (Docodez nuevo): la cámara (capturePhoto) y leer la bomba o el tablero de una foto con la AI (aiExtract). Con un
//   Docodez anterior, se elige la foto de los archivos y se escribe a mano.
import type { DocodezAiField, DocodezContext } from '../../../sdk/docodez';
import { installDevDocodez } from '../../../sdk/docodez-dev';
import { DEFAULT_UNITS, MAINT_PRESETS, PART_KINDS_TEXT, PART_USES, TEXTS } from './i18n';
import {
  type Car, type CarLog, type DueInfo, type FuelEntry, type FuelField, type Maintenance, type Note, type Part, type PartKind, type Repair,
  type Settings, type Trip, KM_PER_MI, PART_EMOJI, PART_KINDS, carTitle, completeFuel, convertUnits, currentOdometer, economyText, fmt,
  fuelOrder, fuelStats, maintenanceStatus, markDone, money, newId, normalizeLog, parseNum, spendingByYear, today, usedFiles,
} from './model';
import { createRichEditor, plainText, sanitize } from './rich';
import { MAKES, decodeVin, modelsFor } from './vpic';
import './style.css';

if (import.meta.env.DEV) installDevDocodez('lynza.carlog');

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
const lang = (['es', 'en', 'fr'] as const).includes(ctx.language) ? ctx.language : 'en';
const t = TEXTS[lang];
const kindName = (k: PartKind) => PART_KINDS_TEXT[lang][k];
let editable = ctx.editable;

// Las unidades de un carro nuevo: las del último que se configuró (datos de la app), si no las del idioma.
const hasAppData = typeof docodez.getAppJSON === 'function';
const appDefaults = (hasAppData ? await docodez.getAppJSON<{ settings?: Partial<Settings> }>().catch(() => null) : null)?.settings;
let log: CarLog = normalizeLog(await docodez.getJSON().catch(() => null), { ...DEFAULT_UNITS[lang], ...appDefaults });
const units = () => log.settings;

type Tab = 'summary' | 'fuel' | 'maint' | 'repairs' | 'parts' | 'trips' | 'notes';
const TABS: [Tab, string, string][] = [
  ['summary', '📊', t.tabSummary], ['fuel', '⛽', t.tabFuel], ['maint', '🛠️', t.tabMaint], ['repairs', '🔧', t.tabRepairs],
  ['parts', '🧰', t.tabParts], ['trips', '🗺️', t.tabTrips], ['notes', '📝', t.tabNotes],
];
let tab: Tab = 'summary';
try { const saved = localStorage.getItem('carlog.tab') as Tab | null; if (saved && TABS.some(([k]) => k === saved)) tab = saved; } catch { /* sin almacenamiento */ }

// --- guardar -------------------------------------------------------------------------------------------------------------
let saveTimer = 0;

async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!editable) return;
  try {
    await docodez.setJSON(log);
    await docodez.setPreview(preview());
  } catch (e) {
    toast(t.saveError + (e as Error).message);
  }
}

// --- avisos y diálogos (prompt/confirm del navegador no andan bien dentro de Docodez) --------------------------------------
let toastTimer = 0;
function toast(text: string): void {
  const box = $('toast');
  box.textContent = text;
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove('on'), 3200);
}

let modalClose: (() => void) | null = null;

/** Un diálogo chico: un texto, un campo opcional y los botones. Devuelve el texto escrito ('' sin campo), o null. */
function dialog(title: string, opts: { input?: string; okText?: string; danger?: boolean } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = $('modal');
    modal.innerHTML = '';
    const box = el('form', 'modal-box');
    box.appendChild(el('h3', '', title));
    let input: HTMLInputElement | null = null;
    if (opts.input != null) {
      input = el('input') as HTMLInputElement;
      input.value = opts.input;
      input.autocomplete = 'off';
      box.appendChild(input);
    }
    const buttons = el('div', 'modal-buttons');
    const cancel = button('btn', t.cancel, () => finish(null));
    const ok = el('button', 'btn primary' + (opts.danger ? ' danger' : ''), opts.okText ?? t.ok) as HTMLButtonElement;
    ok.type = 'submit';
    buttons.append(cancel, ok);
    box.appendChild(buttons);
    modal.appendChild(box);
    modal.hidden = false;
    const finish = (result: string | null) => { modal.hidden = true; modal.innerHTML = ''; modalClose = null; resolve(result); };
    modalClose = () => finish(null);
    box.onsubmit = (e) => { e.preventDefault(); finish(input ? input.value.trim() : ''); };
    if (input) { input.focus(); input.select(); } else ok.focus();
  });
}
const confirmBox = async (text: string, okText = t.ok, danger = false) => (await dialog(text, { okText, danger })) != null;

// --- anexos: fotos y archivos ------------------------------------------------------------------------------------------------
const IMAGE = /\.(jpe?g|png|webp|gif|bmp|heic|avif)$/i;
const isImage = (name: string) => IMAGE.test(name);
const fileUrls = new Map<string, Promise<string>>();
const fileUrl = (name: string) => {
  let url = fileUrls.get(name);
  if (!url) { url = docodez.attachmentUrl(name); fileUrls.set(name, url); }
  return url;
};
/** Fase 11f: Docodez con cámara (API 3, Android). */
const hasCamera = () => !!ctx.camera && typeof docodez.capturePhoto === 'function';

/** Achica una foto (lado mayor 1600 px, JPEG): una foto de celular pesa varios MB y va dentro del documento. */
async function shrink(data: ArrayBuffer): Promise<Blob | ArrayBuffer> {
  try {
    const bitmap = await createImageBitmap(new Blob([data]));
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < data.byteLength ? blob : data;
  } catch {
    return data; // un formato que el navegador no sabe abrir: tal cual
  }
}

type Source = 'camera' | 'photo' | 'file';

/** Pide una foto o un archivo y lo anexa al nodo. Devuelve el nombre del anexo y los bytes originales (para la AI). */
async function addFile(source: Source, prefix: string): Promise<{ name: string; data: ArrayBuffer } | null> {
  try {
    const picked = source === 'camera' ? await docodez.capturePhoto!()
      : await docodez.pickFile(source === 'photo' ? ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'] : []);
    if (!picked) return null;
    const image = isImage(picked.name);
    const data = image ? await shrink(picked.data) : picked.data;
    const ext = image && data instanceof Blob ? 'jpg' : (picked.name.includes('.') ? picked.name.split('.').pop()! : 'bin').toLowerCase();
    const base = image ? prefix : picked.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40) || prefix;
    const name = `car-${base}-${newId().slice(-6)}.${ext}`;
    await docodez.putAttachment(name, data);
    return { name, data: picked.data };
  } catch (e) {
    toast(t.fileError + (e as Error).message);
    return null;
  }
}

/** Quita del nodo los anexos que ya no usa nada de la bitácora. */
async function dropUnused(names: string[]): Promise<void> {
  const used = usedFiles(log);
  for (const name of names) {
    if (used.has(name)) continue;
    fileUrls.delete(name);
    try { await docodez.deleteAttachment?.(name); } catch { /* ya no estaba */ }
  }
}

// --- visor de fotos ----------------------------------------------------------------------------------------------------------
let viewer: { files: string[]; index: number } | null = null;
function openViewer(files: string[], index: number): void {
  viewer = { files, index };
  $('viewer').hidden = false;
  showPhoto();
}
function showPhoto(): void {
  if (!viewer) return;
  const name = viewer.files[viewer.index];
  const img = $<HTMLImageElement>('viewerImg');
  img.removeAttribute('src');
  void fileUrl(name).then((u) => { if (viewer?.files[viewer.index] === name) img.src = u; });
  $('viewerInfo').textContent = t.photoOf(viewer.index + 1, viewer.files.length);
  $('viewerPrev').hidden = $('viewerNext').hidden = viewer.files.length < 2;
}
function moveViewer(step: number): void {
  if (!viewer) return;
  viewer.index = (viewer.index + step + viewer.files.length) % viewer.files.length;
  showPhoto();
}
function closeViewer(): void { $('viewer').hidden = true; viewer = null; }
$('viewerPrev').onclick = () => moveViewer(-1);
$('viewerNext').onclick = () => moveViewer(1);
$('viewerClose').onclick = closeViewer;
let swipeX: number | null = null;
$('viewer').addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
$('viewer').addEventListener('pointerup', (e) => {
  if (swipeX != null && Math.abs(e.clientX - swipeX) > 60) moveViewer(e.clientX < swipeX ? 1 : -1);
  swipeX = null;
});

// --- la hoja de edición (un registro) -------------------------------------------------------------------------------------------
/** Lo que se edita en la hoja abierta: al cancelar, se borran los anexos agregados; al guardar, los quitados. */
interface Sheet { added: string[]; removed: string[]; close: () => void }
let sheet: Sheet | null = null;

function openSheet(title: string, build: (body: HTMLElement, ro: boolean) => void,
  actions: { save: () => boolean | void; remove?: () => void; isNew: boolean }): void {
  const ro = !editable;
  const box = $('sheetBox');
  box.innerHTML = '';
  const head = el('div', 'sheet-head');
  head.appendChild(el('h3', '', title));
  const body = el('div', 'sheet-body');
  const current: Sheet = {
    added: [], removed: [],
    close: () => { $('sheet').hidden = true; box.innerHTML = ''; if (sheet === current) sheet = null; },
  };
  const cancel = async () => {
    current.close();
    await dropUnused(current.added); // lo que se anexó y no se guardó
  };
  head.appendChild(button('icon-btn', '✕', () => void cancel()));
  box.append(head, body);
  build(body, ro);
  if (!ro) {
    const foot = el('div', 'sheet-foot');
    if (actions.remove && !actions.isNew) {
      foot.appendChild(button('btn danger-text', t.delete, async () => {
        if (!(await confirmBox(t.confirmDelete, t.delete, true))) return;
        actions.remove!();
        current.close();
        renderAll();
        await saveNow();
        await dropUnused([...current.added, ...current.removed]);
      }));
    }
    foot.appendChild(el('span', 'grow'));
    foot.appendChild(button('btn', t.cancel, () => void cancel()));
    foot.appendChild(button('btn primary', t.save, async () => {
      if (actions.save() === false) return;
      current.close();
      renderAll();
      await saveNow();
      await dropUnused(current.removed);
    }));
    box.appendChild(foot);
  }
  sheet = current;
  $('sheet').hidden = false;
  $('sheet').scrollTop = 0;
}

/** Un campo con su etiqueta. */
function field(parent: HTMLElement, label: string, control: HTMLElement, cls = ''): HTMLElement {
  // <label> solo con un campo de texto: con botones adentro, tocar la etiqueta apretaría el primero.
  const f = el(control instanceof HTMLInputElement ? 'label' : 'div', 'field ' + cls);
  f.appendChild(el('span', '', label));
  f.appendChild(control);
  parent.appendChild(f);
  return f;
}

function textInput(parent: HTMLElement, label: string, value: string, set: (v: string) => void, ro: boolean,
  opts: { placeholder?: string; mode?: string; cls?: string } = {}): HTMLInputElement {
  const input = el('input') as HTMLInputElement;
  input.value = value;
  input.disabled = ro;
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  if (opts.mode) input.inputMode = opts.mode;
  input.addEventListener('input', () => set(input.value.trim()));
  field(parent, label, input, opts.cls);
  return input;
}

const numText = (v: number | null) => (v == null ? '' : String(v));

function numberInput(parent: HTMLElement, label: string, value: number | null, set: (v: number | null) => void, ro: boolean,
  opts: { cls?: string; placeholder?: string } = {}): HTMLInputElement {
  return textInput(parent, label, numText(value), (v) => set(parseNum(v)), ro, { mode: 'decimal', ...opts });
}

/** Una fecha (aaaa-mm-dd) con un botón "Hoy". No es un <input type=date>: su ventanita nativa sale fuera de lugar en el visor
 *  integrado de Windows (ver sdk/picker.ts). */
function dateInput(parent: HTMLElement, label: string, value: string, set: (v: string) => void, ro: boolean, cls = ''): HTMLInputElement {
  const row = el('div', 'row');
  const input = el('input', 'date') as HTMLInputElement;
  input.value = value;
  input.placeholder = 'aaaa-mm-dd'.replace('aaaa', lang === 'en' ? 'yyyy' : 'aaaa');
  input.inputMode = 'numeric';
  input.disabled = ro;
  input.autocomplete = 'off';
  const check = () => input.classList.toggle('bad', input.value.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(input.value.trim()));
  input.addEventListener('input', () => { set(input.value.trim()); check(); });
  row.appendChild(input);
  if (!ro) row.appendChild(button('btn small', t.today, () => { input.value = today(); set(input.value); check(); }));
  field(parent, label, row, cls);
  return input;
}

function checkbox(parent: HTMLElement, label: string, value: boolean, set: (v: boolean) => void, ro: boolean, hint?: string): HTMLInputElement {
  const wrap = el('label', 'check-row');
  const box = el('input') as HTMLInputElement;
  box.type = 'checkbox';
  box.checked = value;
  box.disabled = ro;
  box.addEventListener('change', () => set(box.checked));
  const text = el('span');
  text.appendChild(el('b', '', label));
  if (hint) text.appendChild(el('small', '', hint));
  wrap.append(box, text);
  parent.appendChild(wrap);
  return box;
}

/** Botones para elegir uno (o para completar un campo). */
function chips(parent: HTMLElement, choices: [string, string][], current: string, pick: (v: string) => void, ro: boolean): HTMLElement {
  const group = el('div', 'choices');
  for (const [value, label] of choices) {
    const b = button('choice' + (value === current ? ' on' : ''), label, () => {
      pick(value);
      group.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === b));
    });
    b.disabled = ro;
    group.appendChild(b);
  }
  parent.appendChild(group);
  return group;
}

/** Las fotos y archivos de un registro (miniaturas; tocar una foto la abre), con los botones para agregar. */
function filesField(parent: HTMLElement, files: string[], prefix: string, ro: boolean, label = t.files): { refresh: () => void } {
  const wrap = el('div', 'files');
  const refresh = () => {
    wrap.innerHTML = '';
    const images = files.filter(isImage);
    for (const name of files) {
      const item = el('div', isImage(name) ? 'thumb' : 'file-chip');
      if (isImage(name)) {
        const img = el('img') as HTMLImageElement;
        img.alt = name;
        void fileUrl(name).then((u) => { img.src = u; });
        item.appendChild(img);
        item.onclick = () => openViewer(images, images.indexOf(name));
      } else {
        item.appendChild(el('span', '', '📄 ' + name.replace(/^car-/, '')));
        item.title = name;
      }
      if (!ro) {
        const x = button('thumb-x', '✕', () => {
          files.splice(files.indexOf(name), 1);
          sheet?.removed.push(name);
          refresh();
        });
        x.title = t.removeFile;
        x.addEventListener('click', (e) => e.stopPropagation());
        item.appendChild(x);
      }
      wrap.appendChild(item);
    }
    if (!ro) {
      const sources: [Source, string][] = hasCamera() ? [['camera', t.camera], ['photo', t.photo], ['file', t.file]] : [['photo', t.photo], ['file', t.file]];
      for (const [source, text] of sources) {
        wrap.appendChild(button('thumb add', text, async () => {
          const got = await addFile(source, prefix);
          if (!got) return;
          files.push(got.name);
          sheet?.added.push(got.name);
          refresh();
        }));
      }
    }
    if (ro && !files.length) wrap.appendChild(el('span', 'muted', '—'));
  };
  refresh();
  field(parent, label, wrap);
  return { refresh };
}

/** El texto con formato: editor en modo edición, la página en modo vista. */
function richField(parent: HTMLElement, label: string, html: string, set: (v: string) => void, ro: boolean, placeholder = ''): void {
  if (ro) {
    const view = el('div', 'rich-view');
    view.innerHTML = sanitize(html) || '<span class="muted">—</span>';
    field(parent, label, view);
    return;
  }
  const editor = createRichEditor(t, html, () => set(editor.html), (title) => dialog(title, { input: 'https://' }), placeholder);
  const f = el('div', 'field');
  f.appendChild(el('span', '', label));
  f.appendChild(editor.element);
  parent.appendChild(f);
}

// --- leer de una foto con la AI ----------------------------------------------------------------------------------------------
async function aiAvailable(): Promise<boolean> {
  if (typeof docodez.aiExtract !== 'function') return false;
  try { return (await docodez.aiCapabilities!()).includes('image.text'); } catch { return false; }
}

/**
 * Saca la foto (o la elige), la deja como anexo del registro y, si hay AI, lee los datos. Devuelve lo leído (null si no
 * se pudo). La persona revisa los valores antes de guardar.
 */
async function readFromPhoto(files: string[], prefix: string, refresh: () => void, instructions: string,
  fields: DocodezAiField[]): Promise<Record<string, number | string | null> | null> {
  const got = await addFile(hasCamera() ? 'camera' : 'photo', prefix);
  if (!got) return null;
  files.push(got.name);
  sheet?.added.push(got.name);
  refresh();
  if (!(await aiAvailable())) { toast(t.noAi); return null; }
  try {
    const values = await docodez.aiExtract!(got.data, instructions, fields);
    if (!values) return null; // canceló
    if (Object.values(values).every((v) => v == null)) { toast(t.aiNothing); return null; }
    toast(t.aiRead);
    return values;
  } catch (e) {
    toast(t.aiError + (e as Error).message);
    return null;
  }
}

const flash = (input: HTMLInputElement) => { input.classList.remove('flash'); void input.offsetWidth; input.classList.add('flash'); };

// --- el carro (arriba) -------------------------------------------------------------------------------------------------------
function renderCar(): void {
  const box = $('car');
  box.innerHTML = '';
  const car = log.car;
  const pic = el('div', 'car-pic');
  if (car.photo) {
    const img = el('img') as HTMLImageElement;
    void fileUrl(car.photo).then((u) => { img.src = u; });
    pic.appendChild(img);
    pic.onclick = () => openViewer([car.photo!], 0);
  } else {
    pic.textContent = '🚗';
  }
  const info = el('div', 'car-info');
  const title = carTitle(car);
  info.appendChild(el('div', 'car-title', title || t.newCar));
  const sub = [car.name.trim() ? [car.year, car.make, car.model].filter(Boolean).join(' ') : '', car.trim, car.plate]
    .filter((x) => x && x.trim()).join(' · ');
  info.appendChild(el('div', 'car-sub', sub || (title ? '' : t.newCarHint)));
  const odo = currentOdometer(log);
  if (odo != null) info.appendChild(el('div', 'car-odo', `🧭 ${fmt(odo)} ${units().distance}`));
  // Fase 11g: el aviso de mantenimiento, a la vista al abrir el carro.
  const due = dueCounts();
  if (due.overdue + due.soon) {
    info.appendChild(button('due-banner' + (due.overdue ? ' alert' : ''), `⚠️ ${t.tabMaint}: ${t.banner(due.overdue, due.soon)}`, () => showTab('maint')));
  }
  box.append(pic, info);
  const tools = el('div', 'car-tools');
  const edit = button('tool' + (editable ? '' : ' ro'), editable ? '✏️' : 'ℹ️', editCar);
  edit.title = t.editCar;
  tools.appendChild(edit);
  const gear = button('tool edit', '⚙️', editSettings);
  gear.title = t.settings;
  tools.appendChild(gear);
  box.appendChild(tools);
}

/** Lista de sugerencias dibujada en la página debajo de un campo (no <datalist>: su ventanita nativa sale fuera de lugar). */
function suggest(input: HTMLInputElement, items: () => string[] | Promise<string[]>): void {
  const host = input.parentElement!;
  host.classList.add('suggest-host');
  const list = el('div', 'suggest');
  list.hidden = true;
  host.appendChild(list);
  let seq = 0;
  const show = async () => {
    const my = ++seq;
    const all = await items();
    if (my !== seq) return;
    const q = input.value.trim().toLowerCase();
    const shown = all.filter((x) => x.toLowerCase().includes(q) && x.toLowerCase() !== q).slice(0, 40);
    list.innerHTML = '';
    for (const s of shown) {
      const item = el('div', 'suggest-item', s);
      item.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        input.value = s;
        input.dispatchEvent(new Event('input'));
        list.hidden = true;
      });
      list.appendChild(item);
    }
    list.hidden = shown.length === 0 || document.activeElement !== input;
  };
  input.addEventListener('focus', () => void show());
  input.addEventListener('input', () => void show());
  input.addEventListener('blur', () => { list.hidden = true; });
}

function editCar(): void {
  const draft: Car = { ...log.car };
  const photo: string[] = draft.photo ? [draft.photo] : [];
  openSheet(t.editCar, (body, ro) => {
    textInput(body, t.carName, draft.name, (v) => (draft.name = v), ro);
    const grid = el('div', 'grid');
    body.appendChild(grid);
    const year = textInput(grid, t.year, draft.year, (v) => (draft.year = v), ro, { mode: 'numeric', cls: 'narrow' });
    const make = textInput(grid, t.make, draft.make, (v) => (draft.make = v), ro);
    const model = textInput(grid, t.model, draft.model, (v) => (draft.model = v), ro);
    const trim = textInput(grid, t.trim, draft.trim, (v) => (draft.trim = v), ro);
    if (!ro) {
      suggest(make, () => MAKES);
      suggest(model, () => modelsFor(make.value, year.value));
      body.appendChild(el('div', 'hint', t.modelsHint));
    }
    const vinRow = el('div', 'grid');
    body.appendChild(vinRow);
    const vin = textInput(vinRow, t.vin, draft.vin, (v) => (draft.vin = v.toUpperCase()), ro, { cls: 'wide' });
    const fuelType = { input: null as HTMLInputElement | null };
    const engine = { input: null as HTMLInputElement | null };
    if (!ro) {
      vinRow.appendChild(button('btn small vin-btn', t.readVin, async () => {
        try {
          const info = await decodeVin(vin.value);
          if (!info) { toast(t.vinUnknown); return; }
          const put = (input: HTMLInputElement | null, value: string, set: (v: string) => void) => {
            if (!input || !value) return;
            input.value = value;
            set(value);
            flash(input);
          };
          put(year, info.year, (v) => (draft.year = v));
          put(make, info.make, (v) => (draft.make = v));
          put(model, info.model, (v) => (draft.model = v));
          put(trim, info.trim, (v) => (draft.trim = v));
          put(fuelType.input, info.fuelType, (v) => (draft.fuelType = v));
          put(engine.input, info.engine, (v) => (draft.engine = v));
          toast(t.vinRead);
        } catch (e) {
          toast(t.vinUnknown + ' ' + (e as Error).message);
        }
      }));
    }
    const grid2 = el('div', 'grid');
    body.appendChild(grid2);
    textInput(grid2, t.plate, draft.plate, (v) => (draft.plate = v), ro);
    textInput(grid2, t.color, draft.color, (v) => (draft.color = v), ro);
    fuelType.input = textInput(grid2, t.fuelType, draft.fuelType, (v) => (draft.fuelType = v), ro);
    engine.input = textInput(grid2, t.engine, draft.engine, (v) => (draft.engine = v), ro);
    numberInput(grid2, t.tank(units().volume), draft.tank, (v) => (draft.tank = v), ro);
    dateInput(grid2, t.purchaseDate, draft.purchaseDate, (v) => (draft.purchaseDate = v), ro);
    numberInput(grid2, t.purchaseOdometer(t.odometer(units().distance)), draft.purchaseOdometer, (v) => (draft.purchaseOdometer = v), ro);
    textInput(body, t.carNotes, draft.notes, (v) => (draft.notes = v), ro);
    filesField(body, photo, 'auto', ro, t.carPhoto);
  }, {
    isNew: false,
    save: () => {
      // Una sola foto: la última que se puso.
      draft.photo = photo.length ? photo[photo.length - 1] : null;
      if (sheet) sheet.removed.push(...photo.slice(0, -1));
      log.car = draft;
    },
  });
}

async function editSettings(): Promise<void> {
  const s = { ...units() };
  openSheet(t.settings, (body) => {
    const d = el('div');
    chips(d, [['km', 'km'], ['mi', 'mi']], s.distance, (v) => (s.distance = v as Settings['distance']), false);
    field(body, t.distance, d);
    const v = el('div');
    chips(v, [['L', t.liters], ['gal', t.gallons]], s.volume, (x) => (s.volume = x as Settings['volume']), false);
    field(body, t.volume, v);
    const e = el('div');
    const renderEconomy = () => {
      e.innerHTML = '';
      chips(e, [['per100', t.per100(s.volume, s.distance)], ['perVolume', t.perVolume(s.volume, s.distance)]], s.economy,
        (x) => (s.economy = x as Settings['economy']), false);
    };
    renderEconomy();
    d.addEventListener('click', renderEconomy);
    v.addEventListener('click', renderEconomy);
    field(body, t.economy, e);
    textInput(body, t.currency, s.currency, (x) => (s.currency = x || '$'), false, { cls: 'narrow' });
  }, {
    isNew: false,
    save: () => {
      const changed = s.distance !== units().distance || s.volume !== units().volume;
      const apply = () => {
        if (changed) convertUnits(log, s.distance, s.volume);
        log.settings.economy = s.economy;
        log.settings.currency = s.currency;
        if (hasAppData) void docodez.setAppJSON({ settings: log.settings }).catch(() => { /* no importa */ });
      };
      const hasData = log.fuel.length + log.trips.length + log.repairs.length + log.parts.length > 0;
      if (changed && hasData) {
        void confirmBox(t.convertAsk).then(async (ok) => { if (ok) { apply(); renderAll(); await saveNow(); } });
        return;
      }
      apply();
    },
  });
}

// --- pestañas ------------------------------------------------------------------------------------------------------------------
function renderTabs(): void {
  const nav = $('tabs');
  nav.innerHTML = '';
  for (const [key, emoji, label] of TABS) {
    const due = key === 'maint' ? dueCounts() : null;
    const count = key === 'fuel' ? log.fuel.length : key === 'repairs' ? log.repairs.length : key === 'parts' ? log.parts.length
      : key === 'trips' ? log.trips.length : key === 'notes' ? log.notes.length : due ? due.overdue + due.soon : 0;
    const b = button('tab' + (key === tab ? ' on' : ''), '', () => showTab(key));
    b.dataset.tab = key;
    b.append(el('span', 'emoji', emoji), el('span', 'tab-label', label));
    if (count) b.appendChild(el('span', 'count' + (due ? (due.overdue ? ' alert' : ' warn') : ''), String(count)));
    nav.appendChild(b);
  }
}

function renderPage(): void {
  const page = $('page');
  page.innerHTML = '';
  page.scrollTop = 0;
  ({ summary: renderSummary, fuel: renderFuel, maint: renderMaint, repairs: renderRepairs, parts: renderParts, trips: renderTrips, notes: renderNotes })[tab](page);
}

function showTab(key: Tab): void {
  tab = key;
  try { localStorage.setItem('carlog.tab', key); } catch { /* sin almacenamiento */ }
  renderTabs();
  renderPage();
}

function renderAll(): void {
  renderCar();
  renderTabs();
  renderPage();
}

function addButton(page: HTMLElement, text: string, onclick: () => void): void {
  const bar = el('div', 'page-bar edit');
  bar.appendChild(button('btn primary', text, onclick));
  page.appendChild(bar);
}

function stat(parent: HTMLElement, label: string, value: string, sub = ''): void {
  const card = el('div', 'stat');
  card.append(el('div', 'stat-label', label), el('div', 'stat-value', value));
  if (sub) card.appendChild(el('div', 'stat-sub', sub));
  parent.appendChild(card);
}

const daysSince = (date: string) => {
  const d = Date.parse(date + 'T00:00:00');
  return isFinite(d) ? Math.max(0, Math.floor((Date.now() - d) / 86400000)) : null;
};
const dist = (v: number | null) => (v == null ? '—' : `${fmt(v)} ${units().distance}`);
const vol = (v: number | null, d = 2) => (v == null ? '—' : `${fmt(v, d)} ${units().volume}`);
const cur = (v: number | null) => money(v, units().currency);

/** Una fila de una lista (tocarla abre el registro). */
function row(parent: HTMLElement, opts: { icon: string; title: string; sub?: string; right?: string; rightSub?: string; files?: number; onclick: () => void; tag?: string }): HTMLElement {
  const r = el('div', 'entry');
  r.appendChild(el('div', 'entry-icon', opts.icon));
  const mid = el('div', 'entry-body');
  const ttl = el('div', 'entry-title', opts.title);
  if (opts.tag) ttl.appendChild(el('span', 'tag', opts.tag));
  mid.appendChild(ttl);
  if (opts.sub) mid.appendChild(el('div', 'entry-sub', opts.sub));
  r.appendChild(mid);
  const right = el('div', 'entry-right');
  if (opts.right) right.appendChild(el('div', 'entry-value', opts.right));
  if (opts.rightSub || opts.files) right.appendChild(el('div', 'entry-sub', [opts.rightSub, opts.files ? `📎 ${opts.files}` : ''].filter(Boolean).join(' · ')));
  r.appendChild(right);
  r.onclick = opts.onclick;
  parent.appendChild(r);
  return r;
}

function empty(page: HTMLElement, text = t.none): void { page.appendChild(el('div', 'empty', text)); }

// --- resumen -------------------------------------------------------------------------------------------------------------
function renderSummary(page: HTMLElement): void {
  const stats = fuelStats(log.fuel);
  const cards = el('div', 'stats');
  stat(cards, t.current, dist(currentOdometer(log)));
  stat(cards, t.avg, economyText(stats.average, units()), stats.average == null ? '' : `${t.last}: ${economyText(stats.last, units())}`);
  stat(cards, t.costPer(units().distance), stats.costPerDistance == null ? '—' : money(stats.costPerDistance, units().currency));
  const lastFuel = fuelOrder(log.fuel).pop();
  if (lastFuel) {
    const n = daysSince(lastFuel.date);
    stat(cards, t.lastFuel, lastFuel.date || '—', n == null ? '' : t.ago(n));
  }
  const lastRepair = [...log.repairs].sort((a, b) => (b.start || b.end).localeCompare(a.start || a.end))[0];
  if (lastRepair) stat(cards, t.lastRepair, lastRepair.title || '—', lastRepair.start || lastRepair.end);
  page.appendChild(cards);

  const pending = maintenanceStatus(log).filter((x) => x.due.state === 'overdue' || x.due.state === 'soon');
  if (pending.length) {
    page.appendChild(el('h4', 'section', t.tabMaint));
    for (const { m, due } of pending) maintRow(page, m, due);
  }

  const years = spendingByYear(log);
  if (years.length) {
    page.appendChild(el('h4', 'section', t.byYear));
    const table = el('table', 'years');
    table.innerHTML = `<thead><tr><th></th><th>⛽ ${esc(t.fuel)}</th><th>🔧 ${esc(t.repairs)}</th><th>🧰 ${esc(t.parts)}</th><th>${esc(t.all)}</th></tr></thead>`;
    const tbody = el('tbody');
    for (const y of years) {
      const tr = el('tr');
      tr.innerHTML = `<th>${esc(y.year)}</th><td>${esc(cur(y.fuel))}</td><td>${esc(cur(y.repairs))}</td><td>${esc(cur(y.parts))}</td><td><b>${esc(cur(y.fuel + y.repairs + y.parts))}</b></td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    const wrap = el('div', 'table-wrap');
    wrap.appendChild(table);
    page.appendChild(wrap);
  }

  // Lo que lleva puesto (los accesorios, agrupados).
  if (log.parts.length) {
    page.appendChild(el('h4', 'section', t.tabParts));
    const list = el('div', 'part-summary');
    for (const kind of PART_KINDS) {
      const parts = log.parts.filter((p) => p.kind === kind);
      if (!parts.length) continue;
      const line = el('div', 'part-line');
      line.appendChild(el('span', 'emoji', PART_EMOJI[kind]));
      line.appendChild(el('span', '', parts.map((p) => [p.use, [p.brand, p.name, p.spec].filter(Boolean).join(' ')].filter(Boolean).join(': ')).join(' · ')));
      line.onclick = () => showTab('parts');
      list.appendChild(line);
    }
    page.appendChild(list);
  }
  if (!log.fuel.length && !log.repairs.length && !log.parts.length && !years.length) empty(page, editable ? t.newCarHint : t.none);
}

// --- gasolina ------------------------------------------------------------------------------------------------------------
function renderFuel(page: HTMLElement): void {
  addButton(page, t.addFuel, () => editFuel(null));
  const stats = fuelStats(log.fuel);
  const s = units();
  const cards = el('div', 'stats');
  stat(cards, t.avg, economyText(stats.average, s), stats.segments.length > 1 ? `${t.best}: ${economyText(stats.best, s)} · ${t.worst}: ${economyText(stats.worst, s)}` : '');
  stat(cards, t.last, economyText(stats.last, s));
  stat(cards, t.costPer(s.distance), stats.costPerDistance == null ? '—' : money(stats.costPerDistance, s.currency));
  stat(cards, t.spent, cur(stats.totalCost), t.loads(stats.count));
  stat(cards, t.totalVolume, vol(stats.totalVolume, 1), stats.distance != null ? dist(stats.distance) : '');
  stat(cards, t.avgPrice, stats.averagePrice == null ? '—' : `${money(stats.averagePrice, s.currency)}/${s.volume}`);
  page.appendChild(cards);
  if (!stats.segments.length && log.fuel.length) page.appendChild(el('div', 'hint', t.needTwoFull));
  if (stats.segments.length > 1) page.appendChild(chart(stats.segments.map((x) => ({ label: x.date, rate: x.volume / x.distance }))));

  const rates = new Map(stats.segments.map((x) => [x.entryId, x.volume / x.distance]));
  const ordered = fuelOrder(log.fuel).reverse();
  if (!ordered.length) { empty(page); return; }
  for (const e of ordered) {
    const rate = rates.get(e.id);
    row(page, {
      icon: '⛽',
      title: e.date || '—',
      tag: e.full ? t.fullShort : t.partial,
      sub: [e.odometer != null ? dist(e.odometer) : '', e.station, rate != null ? economyText(rate, s) : ''].filter(Boolean).join(' · '),
      right: cur(e.total),
      rightSub: [e.volume != null ? vol(e.volume) : '', e.price != null ? `${money(e.price, s.currency)}/${s.volume}` : ''].filter(Boolean).join(' · '),
      files: e.files.length,
      onclick: () => editFuel(e),
    });
  }
}

/** El consumo de cada tanque, como un gráfico de línea chico (SVG). */
function chart(points: { label: string; rate: number }[]): HTMLElement {
  const s = units();
  const shown = (r: number) => (s.economy === 'per100' ? r * 100 : 1 / r);
  const values = points.map((p) => shown(p.rate));
  const min = Math.min(...values), max = Math.max(...values);
  const w = 600, h = 140, pad = 28;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const box = el('div', 'chart');
  box.appendChild(el('div', 'chart-title', `${t.trend} (${economyText(s.economy === 'per100' ? 0.01 : 1, s).replace(/^[\d.,\s]+/, '')})`));
  box.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
    <line x1="${pad}" y1="${y(min)}" x2="${w - pad}" y2="${y(min)}" class="grid-line"/>
    <line x1="${pad}" y1="${y(max)}" x2="${w - pad}" y2="${y(max)}" class="grid-line"/>
    <text x="2" y="${y(max) + 4}" class="axis">${fmt(max, 1)}</text><text x="2" y="${y(min) + 4}" class="axis">${fmt(min, 1)}</text>
    <path d="${path}" class="line"/>
    ${values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" class="dot"><title>${esc(points[i].label)}: ${fmt(v, 1)}</title></circle>`).join('')}
  </svg>`);
  return box;
}

function lastOdometerBefore(excludeId: string): number | null {
  const odos = log.fuel.filter((e) => e.id !== excludeId).map((e) => e.odometer).filter((v): v is number => v != null);
  return odos.length ? Math.max(...odos) : null;
}

function editFuel(entry: FuelEntry | null): void {
  const isNew = !entry;
  const draft: FuelEntry = entry ? { ...entry, files: [...entry.files] }
    : { id: newId(), date: today(), odometer: null, volume: null, price: lastPrice(), total: null, full: true, missed: false, station: lastStation(), note: '', files: [] };
  const s = units();
  openSheet(t.fuelEntry, (body, ro) => {
    const grid = el('div', 'grid');
    body.appendChild(grid);
    dateInput(grid, t.date, draft.date, (v) => (draft.date = v), ro);
    const odo = numberInput(grid, t.odometer(s.distance), draft.odometer, (v) => { draft.odometer = v; checkOdo(); }, ro);
    const prev = lastOdometerBefore(draft.id);
    const odoHint = el('div', 'hint');
    odo.parentElement!.appendChild(odoHint);
    const checkOdo = () => {
      const lower = prev != null && draft.odometer != null && draft.odometer < prev && isNew;
      odoHint.textContent = lower ? t.odometerLower : prev != null ? t.lastOdometer(dist(prev)) : '';
      odoHint.classList.toggle('warn', lower);
    };
    checkOdo();

    // Cantidad, precio y total: de dos sale el tercero.
    const money3 = el('div', 'grid three');
    body.appendChild(money3);
    const inputs = {} as Record<FuelField, HTMLInputElement>;
    let edited: FuelField[] = [];
    const onEdit = (f: FuelField, v: number | null) => {
      draft[f] = v;
      edited = [f, ...edited.filter((x) => x !== f)].slice(0, 2);
      const computed = completeFuel(draft, edited);
      if (computed) { inputs[computed].value = numText(draft[computed]); inputs[computed].classList.add('computed'); }
      for (const k of edited) inputs[k].classList.remove('computed');
    };
    inputs.volume = numberInput(money3, t.quantity(s.volume), draft.volume, (v) => onEdit('volume', v), ro);
    inputs.price = numberInput(money3, t.pricePer(s.currency, s.volume), draft.price, (v) => onEdit('price', v), ro);
    inputs.total = numberInput(money3, t.total(s.currency), draft.total, (v) => onEdit('total', v), ro);

    let files: { refresh: () => void } = { refresh: () => {} };
    if (!ro) {
      const reads = el('div', 'row wrap');
      reads.appendChild(button('btn small', t.readPump, async () => {
        const values = await readFromPhoto(draft.files, 'bomba', () => files.refresh(),
          `This is a photo of a fuel pump display or a fuel receipt. The volume unit is ${s.volume === 'L' ? 'liters' : 'US gallons'}.`, [
            { name: 'volume', type: 'number', description: `the amount of fuel dispensed (${s.volume === 'L' ? 'liters' : 'gallons'})` },
            { name: 'price', type: 'number', description: 'the price per unit of volume' },
            { name: 'total', type: 'number', description: 'the total amount to pay (sale)' },
            { name: 'date', type: 'date', description: 'the date, if it is a receipt' },
          ]);
        if (!values) return;
        for (const f of ['volume', 'price', 'total'] as FuelField[]) {
          if (typeof values[f] === 'number') { draft[f] = values[f] as number; inputs[f].value = numText(draft[f]); flash(inputs[f]); }
        }
        // Si faltó uno de los tres, sale de los otros dos.
        const have = (['total', 'volume', 'price'] as FuelField[]).filter((f) => typeof values[f] === 'number');
        if (have.length === 2) { const c = completeFuel(draft, have); if (c) { inputs[c].value = numText(draft[c]); inputs[c].classList.add('computed'); } }
      }));
      reads.appendChild(button('btn small', t.readOdometer, async () => {
        const values = await readFromPhoto(draft.files, 'tablero', () => files.refresh(),
          'This is a photo of a car dashboard / instrument cluster.', [
            { name: 'odometer', type: 'number', description: 'the odometer reading: the total distance of the car (the big total counter, not a trip meter like TRIP A/B)' },
          ]);
        if (values && typeof values.odometer === 'number') { draft.odometer = Math.round(values.odometer); odo.value = numText(draft.odometer); flash(odo); checkOdo(); }
      }));
      body.appendChild(reads);
    }
    checkbox(body, t.full, draft.full, (v) => (draft.full = v), ro, t.fullHint);
    checkbox(body, t.missed, draft.missed, (v) => (draft.missed = v), ro);
    textInput(body, t.station, draft.station, (v) => (draft.station = v), ro);
    textInput(body, t.note, draft.note, (v) => (draft.note = v), ro);
    files = filesField(body, draft.files, 'gasolina', ro);
  }, {
    isNew,
    save: () => {
      const i = log.fuel.findIndex((e) => e.id === draft.id);
      if (i >= 0) log.fuel[i] = draft; else log.fuel.push(draft);
    },
    remove: () => { log.fuel = log.fuel.filter((e) => e.id !== draft.id); sheet?.removed.push(...draft.files); },
  });
}

const lastPrice = () => fuelOrder(log.fuel).reverse().find((e) => e.price != null)?.price ?? null;
const lastStation = () => fuelOrder(log.fuel).reverse().find((e) => e.station)?.station ?? '';

// --- Fase 11g: mantenimiento ----------------------------------------------------------------------------------------------
function dueCounts(): { overdue: number; soon: number } {
  const all = maintenanceStatus(log);
  return { overdue: all.filter((x) => x.due.state === 'overdue').length, soon: all.filter((x) => x.due.state === 'soon').length };
}

/** Cuándo toca, en palabras: "faltan 1.200 km (≈ 25 días) · en 40 días (el 2026-12-01)". */
function dueText(m: Maintenance, due: DueInfo): string {
  if (!m.last) return t.noLast;
  const parts: string[] = [];
  if (due.distanceLeft != null) {
    const d = due.distanceLeft > 0 ? t.leftDistance(dist(due.distanceLeft)) : t.overDistance(dist(-due.distanceLeft));
    parts.push(d + (due.distanceLeft > 0 && due.daysByDistance != null ? ` (${t.approxDays(due.daysByDistance)})` : ''));
  } else if (due.dueOdometer != null) {
    parts.push(dist(due.dueOdometer));
  }
  if (due.daysLeft != null) parts.push(`${due.daysLeft >= 0 ? t.leftDays(due.daysLeft) : t.overDays(-due.daysLeft)} (${t.dueOn(due.dueDate)})`);
  return parts.join(' · ') || t.needInterval;
}

const stateText = (s: DueInfo['state']) => ({ overdue: t.overdue, soon: t.soon, ok: t.upToDate, unknown: t.unknown })[s];

function maintRow(page: HTMLElement, m: Maintenance, due: DueInfo): void {
  const r = row(page, {
    icon: m.icon, title: m.title || '—', tag: stateText(due.state), sub: dueText(m, due),
    rightSub: m.last ? [m.last.date, m.last.odometer != null ? dist(m.last.odometer) : ''].filter(Boolean).join(' · ') : '',
    onclick: () => editMaint(m),
  });
  r.classList.add('due-' + due.state);
  if (editable) {
    const done = button('btn small done-btn', t.done, () => doneMaint(m));
    done.addEventListener('click', (e) => e.stopPropagation());
    r.appendChild(done);
  }
}

/** Un intervalo de los sugeridos (en km) en las unidades del carro (millas: redondeado a 500). */
const presetDistance = (km: number | null) => (km == null ? null : units().distance === 'km' ? km : Math.round(km / KM_PER_MI / 500) * 500);

function renderMaint(page: HTMLElement): void {
  addButton(page, t.addMaint, () => editMaint(null));
  const list = maintenanceStatus(log);
  if (!list.length) page.appendChild(el('div', 'hint', t.maintHint));
  for (const { m, due } of list) maintRow(page, m, due);
  // Los sugeridos que todavía no están.
  const have = new Set(log.maintenance.map((m) => m.title.trim().toLowerCase()));
  const presets = MAINT_PRESETS[lang].filter(([, title]) => !have.has(title.toLowerCase()));
  if (editable && presets.length) {
    page.appendChild(el('h4', 'section', t.presets));
    page.appendChild(el('div', 'hint', t.presetHint));
    const box = el('div', 'choices presets');
    for (const [icon, title, km, months] of presets) {
      const every = [km != null ? dist(presetDistance(km)) : '', months != null ? `${months} m` : ''].filter(Boolean).join(' / ');
      box.appendChild(button('choice', `${icon} ${title} · ${every}`, () =>
        editMaint(null, { title, icon, everyDistance: presetDistance(km), everyMonths: months })));
    }
    page.appendChild(box);
  }
}

function editMaint(entry: Maintenance | null, preset?: Partial<Maintenance>): void {
  const draft: Maintenance = entry ? { ...entry, last: entry.last ? { ...entry.last } : null, history: [...entry.history] }
    : { id: newId(), title: '', icon: '🛠️', everyDistance: null, everyMonths: null, last: null, history: [], note: '', ...preset };
  const last = { date: draft.last?.date ?? '', odometer: draft.last?.odometer ?? null };
  openSheet(t.maint, (body, ro) => {
    const grid = el('div', 'grid');
    body.appendChild(grid);
    textInput(grid, t.maintTitle, draft.title, (v) => (draft.title = v), ro, { cls: 'wide' });
    numberInput(grid, t.everyDistance(units().distance), draft.everyDistance, (v) => (draft.everyDistance = v), ro);
    numberInput(grid, t.everyMonths, draft.everyMonths, (v) => (draft.everyMonths = v), ro);
    textInput(grid, t.icon, draft.icon, (v) => (draft.icon = v || '🛠️'), ro, { cls: 'narrow' });
    body.appendChild(el('h4', 'section', t.lastTime));
    const grid2 = el('div', 'grid');
    body.appendChild(grid2);
    dateInput(grid2, t.date, last.date, (v) => (last.date = v), ro);
    numberInput(grid2, t.odometer(units().distance), last.odometer, (v) => (last.odometer = v), ro);
    textInput(body, t.note, draft.note, (v) => (draft.note = v), ro);
    if (draft.history.length) {
      const h = el('div', 'history');
      for (const d of draft.history) h.appendChild(el('div', '', [d.date, d.odometer != null ? dist(d.odometer) : ''].filter(Boolean).join(' · ')));
      field(body, t.history, h);
    }
  }, {
    isNew: !entry,
    save: () => {
      if (!draft.everyDistance && !draft.everyMonths) { toast(t.needInterval); return false; }
      draft.last = last.date || last.odometer != null ? { date: last.date, odometer: last.odometer } : null;
      upsert(log.maintenance, draft);
    },
    remove: () => { log.maintenance = log.maintenance.filter((e) => e.id !== draft.id); },
  });
}

/** "✓ Hecho": la fecha y el odómetro de hoy (se pueden cambiar); y, si se quiere, también como reparación con su costo. */
function doneMaint(m: Maintenance): void {
  const when = { date: today(), odometer: currentOdometer(log), cost: null as number | null, note: '', repair: true };
  openSheet(t.doneTitle(m.title), (body, ro) => {
    const grid = el('div', 'grid');
    body.appendChild(grid);
    dateInput(grid, t.date, when.date, (v) => (when.date = v), ro);
    numberInput(grid, t.odometer(units().distance), when.odometer, (v) => (when.odometer = v), ro);
    numberInput(grid, `${t.cost} (${units().currency})`, when.cost, (v) => (when.cost = v), ro);
    textInput(body, t.note, when.note, (v) => (when.note = v), ro);
    checkbox(body, t.addToRepairs, when.repair, (v) => (when.repair = v), ro);
  }, {
    isNew: true,
    save: () => {
      markDone(m, { date: when.date, odometer: when.odometer });
      if (when.repair) {
        log.repairs.push({ id: newId(), title: `${m.icon} ${m.title}`.trim(), start: when.date, end: when.date, odometer: when.odometer, mechanic: '', shop: '',
          cost: when.cost, html: when.note ? `<p>${esc(when.note)}</p>` : '', files: [] });
      }
    },
  });
}

// --- reparaciones --------------------------------------------------------------------------------------------------------
function renderRepairs(page: HTMLElement): void {
  addButton(page, t.addRepair, () => editRepair(null));
  if (log.repairs.length) {
    const cards = el('div', 'stats');
    stat(cards, t.repairsTotal, cur(log.repairs.reduce((a, r) => a + (r.cost ?? 0), 0)), String(log.repairs.length));
    page.appendChild(cards);
  }
  const list = [...log.repairs].sort((a, b) => (b.start || b.end).localeCompare(a.start || a.end));
  if (!list.length) { empty(page); return; }
  for (const r of list) {
    const when = r.start && r.end && r.end !== r.start ? `${r.start} → ${r.end}` : r.start || r.end;
    row(page, {
      icon: '🔧', title: r.title || '—', tag: r.start && !r.end ? t.inProgress : undefined,
      sub: [when, [r.mechanic, r.shop].filter(Boolean).join(' · '), r.odometer != null ? dist(r.odometer) : '', plainText(r.html).slice(0, 120)].filter(Boolean).join(' — '),
      right: r.cost != null ? cur(r.cost) : '', files: r.files.length, onclick: () => editRepair(r),
    });
  }
}

function editRepair(entry: Repair | null): void {
  const draft: Repair = entry ? { ...entry, files: [...entry.files] }
    : { id: newId(), title: '', start: today(), end: '', odometer: currentOdometer(log), mechanic: '', shop: '', cost: null, html: '', files: [] };
  openSheet(t.repair, (body, ro) => {
    textInput(body, t.repairTitle, draft.title, (v) => (draft.title = v), ro);
    const grid = el('div', 'grid');
    body.appendChild(grid);
    dateInput(grid, t.start, draft.start, (v) => (draft.start = v), ro);
    dateInput(grid, t.end, draft.end, (v) => (draft.end = v), ro);
    textInput(grid, t.mechanic, draft.mechanic, (v) => (draft.mechanic = v), ro);
    textInput(grid, t.shop, draft.shop, (v) => (draft.shop = v), ro);
    numberInput(grid, t.odometer(units().distance), draft.odometer, (v) => (draft.odometer = v), ro);
    numberInput(grid, `${t.cost} (${units().currency})`, draft.cost, (v) => (draft.cost = v), ro);
    richField(body, t.notes, draft.html, (v) => (draft.html = v), ro, t.notesPlaceholder);
    filesField(body, draft.files, 'reparacion', ro);
  }, {
    isNew: !entry,
    save: () => { upsert(log.repairs, draft); },
    remove: () => { log.repairs = log.repairs.filter((e) => e.id !== draft.id); sheet?.removed.push(...draft.files); },
  });
}

function upsert<T extends { id: string }>(list: T[], item: T): void {
  const i = list.findIndex((e) => e.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
}

// --- accesorios ------------------------------------------------------------------------------------------------------------
function renderParts(page: HTMLElement): void {
  addButton(page, t.addPart, () => editPart(null));
  if (!log.parts.length) { empty(page); return; }
  for (const kind of PART_KINDS) {
    const parts = log.parts.filter((p) => p.kind === kind);
    if (!parts.length) continue;
    const head = el('div', 'group-head');
    head.append(el('span', 'emoji', PART_EMOJI[kind]), el('span', '', kindName(kind)), el('span', 'count', String(parts.length)));
    page.appendChild(head);
    for (const p of parts.sort((a, b) => a.use.localeCompare(b.use))) {
      row(page, {
        icon: PART_EMOJI[kind], title: [p.brand, p.name].filter(Boolean).join(' ') || kindName(kind), tag: p.use || undefined,
        sub: [p.spec, p.date, p.odometer != null ? dist(p.odometer) : '', p.where, p.note].filter(Boolean).join(' · '),
        right: p.cost != null ? cur(p.cost) : '', files: p.files.length, onclick: () => editPart(p),
      });
    }
  }
}

function editPart(entry: Part | null, kind: PartKind = 'tires'): void {
  const draft: Part = entry ? { ...entry, files: [...entry.files] }
    : { id: newId(), kind, name: '', brand: '', spec: '', use: '', date: '', odometer: null, cost: null, where: '', note: '', files: [] };
  openSheet(t.part, (body, ro) => {
    const kinds = el('div');
    field(body, t.kind, kinds);
    let useInput: HTMLInputElement;
    const usesBox = el('div');
    const renderUses = () => {
      usesBox.innerHTML = '';
      const uses = PART_USES[lang][draft.kind];
      if (!ro && uses.length) chips(usesBox, uses.map((u) => [u, u]), draft.use, (v) => { draft.use = v; useInput.value = v; }, ro);
    };
    chips(kinds, PART_KINDS.map((k) => [k, `${PART_EMOJI[k]} ${kindName(k)}`]), draft.kind, (v) => { draft.kind = v as PartKind; renderUses(); }, ro);
    const grid = el('div', 'grid');
    body.appendChild(grid);
    textInput(grid, t.partName, draft.name, (v) => (draft.name = v), ro);
    textInput(grid, t.brand, draft.brand, (v) => (draft.brand = v), ro);
    textInput(grid, t.spec, draft.spec, (v) => (draft.spec = v), ro, { placeholder: lang === 'en' ? '225/45 R17, 5W-30, H7...' : '225/45 R17, 5W-30, H7...' });
    useInput = textInput(grid, t.use, draft.use, (v) => (draft.use = v), ro, { placeholder: t.usePlaceholder });
    body.appendChild(usesBox);
    renderUses();
    const grid2 = el('div', 'grid');
    body.appendChild(grid2);
    dateInput(grid2, t.installed, draft.date, (v) => (draft.date = v), ro);
    numberInput(grid2, t.odometer(units().distance), draft.odometer, (v) => (draft.odometer = v), ro);
    numberInput(grid2, `${t.cost} (${units().currency})`, draft.cost, (v) => (draft.cost = v), ro);
    textInput(grid2, t.where, draft.where, (v) => (draft.where = v), ro);
    textInput(body, t.note, draft.note, (v) => (draft.note = v), ro);
    filesField(body, draft.files, 'pieza', ro);
  }, {
    isNew: !entry,
    save: () => { upsert(log.parts, draft); },
    remove: () => { log.parts = log.parts.filter((e) => e.id !== draft.id); sheet?.removed.push(...draft.files); },
  });
}

// --- viajes ----------------------------------------------------------------------------------------------------------------
function renderTrips(page: HTMLElement): void {
  addButton(page, t.addTrip, () => editTrip(null));
  const total = log.trips.reduce((a, x) => a + (x.odoStart != null && x.odoEnd != null && x.odoEnd > x.odoStart ? x.odoEnd - x.odoStart : 0), 0);
  if (total > 0) {
    const cards = el('div', 'stats');
    stat(cards, t.tripsTotal, dist(total), String(log.trips.length));
    page.appendChild(cards);
  }
  const list = [...log.trips].sort((a, b) => b.start.localeCompare(a.start));
  if (!list.length) { empty(page); return; }
  for (const x of list) {
    const km = x.odoStart != null && x.odoEnd != null && x.odoEnd > x.odoStart ? x.odoEnd - x.odoStart : null;
    row(page, {
      icon: '🗺️', title: x.title || [x.from, x.to].filter(Boolean).join(' → ') || '—',
      sub: [x.start && x.end && x.end !== x.start ? `${x.start} → ${x.end}` : x.start, x.title ? [x.from, x.to].filter(Boolean).join(' → ') : '', plainText(x.html).slice(0, 120)]
        .filter(Boolean).join(' — '),
      right: km != null ? dist(km) : '', files: x.files.length, onclick: () => editTrip(x),
    });
  }
}

function editTrip(entry: Trip | null): void {
  const draft: Trip = entry ? { ...entry, files: [...entry.files] }
    : { id: newId(), title: '', start: today(), end: '', from: '', to: '', odoStart: currentOdometer(log), odoEnd: null, html: '', files: [] };
  openSheet(t.trip, (body, ro) => {
    textInput(body, t.tripTitle, draft.title, (v) => (draft.title = v), ro);
    const grid = el('div', 'grid');
    body.appendChild(grid);
    textInput(grid, t.from, draft.from, (v) => (draft.from = v), ro);
    textInput(grid, t.to, draft.to, (v) => (draft.to = v), ro);
    dateInput(grid, t.leave, draft.start, (v) => (draft.start = v), ro);
    dateInput(grid, t.back, draft.end, (v) => (draft.end = v), ro);
    numberInput(grid, t.odoStart, draft.odoStart, (v) => (draft.odoStart = v), ro);
    numberInput(grid, t.odoEnd, draft.odoEnd, (v) => (draft.odoEnd = v), ro);
    richField(body, t.notes, draft.html, (v) => (draft.html = v), ro);
    filesField(body, draft.files, 'viaje', ro);
  }, {
    isNew: !entry,
    save: () => { upsert(log.trips, draft); },
    remove: () => { log.trips = log.trips.filter((e) => e.id !== draft.id); sheet?.removed.push(...draft.files); },
  });
}

// --- notas -------------------------------------------------------------------------------------------------------------------
function renderNotes(page: HTMLElement): void {
  addButton(page, t.addNote, () => editNote(null));
  const list = [...log.notes].sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) { empty(page); return; }
  for (const n of list) {
    row(page, { icon: '📝', title: n.title || '—', sub: [n.date, plainText(n.html).slice(0, 160)].filter(Boolean).join(' — '), files: n.files.length, onclick: () => editNote(n) });
  }
}

function editNote(entry: Note | null): void {
  const draft: Note = entry ? { ...entry, files: [...entry.files] } : { id: newId(), title: '', date: today(), html: '', files: [] };
  openSheet(t.noteTitle, (body, ro) => {
    const grid = el('div', 'grid');
    body.appendChild(grid);
    textInput(grid, t.title, draft.title, (v) => (draft.title = v), ro, { cls: 'wide' });
    dateInput(grid, t.date, draft.date, (v) => (draft.date = v), ro);
    richField(body, t.notes, draft.html, (v) => (draft.html = v), ro);
    filesField(body, draft.files, 'nota', ro);
  }, {
    isNew: !entry,
    save: () => { upsert(log.notes, draft); },
    remove: () => { log.notes = log.notes.filter((e) => e.id !== draft.id); sheet?.removed.push(...draft.files); },
  });
}

// --- página de respaldo (búsqueda, lectores sin el plugin) ---------------------------------------------------------------
function preview(): string {
  const s = units();
  const car = log.car;
  const stats = fuelStats(log.fuel);
  const p = [`<h2>🚗 ${esc(carTitle(car) || ctx.nodeTitle)}</h2>`];
  const details = [[t.year, car.year], [t.make, car.make], [t.model, car.model], [t.trim, car.trim], [t.vin, car.vin], [t.plate, car.plate],
    [t.color, car.color], [t.fuelType, car.fuelType], [t.engine, car.engine], [t.current, dist(currentOdometer(log))]].filter(([, v]) => v && v !== '—');
  if (details.length) p.push('<p>' + details.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('<br>') + '</p>');
  if (car.notes) p.push(`<p>${esc(car.notes)}</p>`);
  if (log.fuel.length) {
    p.push(`<h3>⛽ ${esc(t.tabFuel)}</h3><p>${esc(t.avg)}: ${esc(economyText(stats.average, s))} · ${esc(t.spent)}: ${esc(cur(stats.totalCost))} · ${esc(t.loads(stats.count))}</p><ul>`);
    for (const e of fuelOrder(log.fuel).reverse().slice(0, 20)) {
      p.push(`<li>${esc(e.date)} — ${esc(dist(e.odometer))} — ${esc(vol(e.volume))} — ${esc(cur(e.total))}${e.station ? ' — ' + esc(e.station) : ''}</li>`);
    }
    p.push('</ul>');
  }
  if (log.maintenance.length) {
    p.push(`<h3>🛠️ ${esc(t.tabMaint)}</h3><ul>`);
    for (const { m, due } of maintenanceStatus(log)) p.push(`<li>${esc(m.icon)} <b>${esc(m.title)}</b> — ${esc(stateText(due.state))}: ${esc(dueText(m, due))}</li>`);
    p.push('</ul>');
  }
  if (log.repairs.length) {
    p.push(`<h3>🔧 ${esc(t.tabRepairs)}</h3><ul>`);
    for (const r of log.repairs) p.push(`<li><b>${esc(r.title)}</b> ${esc(r.start)}${r.end ? ' → ' + esc(r.end) : ''}${r.mechanic ? ' · ' + esc(r.mechanic) : ''}${r.shop ? ' · ' + esc(r.shop) : ''}${r.cost != null ? ' · ' + esc(cur(r.cost)) : ''}${r.html ? '<br>' + sanitize(r.html) : ''}</li>`);
    p.push('</ul>');
  }
  if (log.parts.length) {
    p.push(`<h3>🧰 ${esc(t.tabParts)}</h3><ul>`);
    for (const x of log.parts) p.push(`<li>${PART_EMOJI[x.kind]} ${esc(kindName(x.kind))}: <b>${esc([x.brand, x.name].filter(Boolean).join(' '))}</b>${x.spec ? ' — ' + esc(x.spec) : ''}${x.use ? ' (' + esc(x.use) + ')' : ''}${x.note ? ' — ' + esc(x.note) : ''}</li>`);
    p.push('</ul>');
  }
  if (log.trips.length) {
    p.push(`<h3>🗺️ ${esc(t.tabTrips)}</h3><ul>`);
    for (const x of log.trips) p.push(`<li><b>${esc(x.title || [x.from, x.to].filter(Boolean).join(' → '))}</b> ${esc(x.start)}${x.end ? ' → ' + esc(x.end) : ''}${x.html ? '<br>' + sanitize(x.html) : ''}</li>`);
    p.push('</ul>');
  }
  if (log.notes.length) {
    p.push(`<h3>📝 ${esc(t.tabNotes)}</h3>`);
    for (const n of log.notes) p.push(`<h4>${esc(n.title)} <small>${esc(n.date)}</small></h4>${sanitize(n.html)}`);
  }
  return p.join('');
}

// --- modo, tema, eventos -------------------------------------------------------------------------------------------------------
function setEditable(value: boolean): void {
  editable = value;
  document.body.classList.toggle('editable', value);
  $('viewNote').hidden = value;
  if (sheet) sheet.close();
  renderAll();
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.body.classList.toggle('dark', theme === 'dark');
}

docodez.on('modechange', (p) => setEditable(p.editable));
docodez.on('themechange', (p) => applyTheme(p.theme));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (modalClose) modalClose();
  else if (!$('viewer').hidden) closeViewer();
  else if (sheet) ($('sheetBox').querySelector('.sheet-head .icon-btn') as HTMLButtonElement | null)?.click();
});
$('sheet').addEventListener('pointerdown', (e) => {
  if (e.target === $('sheet')) ($('sheetBox').querySelector('.sheet-head .icon-btn') as HTMLButtonElement | null)?.click();
});
$('viewNote').textContent = t.viewMode;
$('viewerClose').setAttribute('aria-label', t.close);
document.documentElement.lang = lang;
document.title = carTitle(log.car) || t.newCar;

applyTheme(ctx.theme);
setEditable(editable);

// Para las pruebas automáticas.
(window as unknown as Record<string, unknown>).__carlog = {
  get log() { return log; }, set log(v: CarLog) { log = normalizeLog(v); renderAll(); },
  editFuel, editRepair, editPart, editTrip, editNote, editCar, editSettings, editMaint, doneMaint, saveNow, renderAll, preview,
  setTab(k: Tab) { tab = k; renderTabs(); renderPage(); },
};
