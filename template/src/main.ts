// Quick Notes — a minimal Docodez plugin to copy and adapt. It shows the essentials:
// - wait for docodez.ready and read the context (language, theme, edit mode, platform);
// - load the node's data with getJSON and save it with setJSON after each change (debounced);
// - follow modechange / themechange;
// - attach a photo to the node (pickFile or, on Android with API 3, capturePhoto) and show it with attachmentUrl;
// - keep a plain HTML preview with setPreview (search indexes it; users without the plugin see it).
// API reference: ../../docs/api.md
import type { DocodezContext } from '../../sdk/docodez';
import { installDevDocodez } from '../../sdk/docodez-dev';
import { TEXTS } from './i18n';
import './style.css';

// Outside Docodez (npm run dev) a fake window.docodez is installed; it is not in the built plugin.
if (import.meta.env.DEV) installDevDocodez('example.notes');

interface Note { id: string; text: string; photo: string | null; at: string }
interface Data { version: 1; notes: Note[] }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const ctx: DocodezContext = await docodez.ready;
const t = TEXTS[ctx.language] ?? TEXTS.en;
let editable = ctx.editable;
let data: Data = normalize(await docodez.getJSON().catch(() => null));

/** Old or missing data → the current shape (always accept what an older version saved). */
function normalize(raw: unknown): Data {
  const notes = (raw as Partial<Data> | null)?.notes;
  return { version: 1, notes: Array.isArray(notes) ? notes.filter((n) => n && typeof n.text === 'string') : [] };
}

// --- saving: a short debounce after each change (there is no "close" event) -----------------------------------------
let saveTimer = 0;
function scheduleSave(): void {
  if (!editable) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 400);
}

async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  if (!editable) return;
  try {
    await docodez.setJSON(data);
    await docodez.setPreview(preview());
  } catch (e) {
    toast(t.saveError + (e as Error).message);
  }
}

/** The plain HTML version of the node (no scripts): searchable, and shown where the plugin is not installed. */
function preview(): string {
  return `<h2>${esc(t.previewTitle)}</h2><ul>${data.notes.map((n) => `<li>${esc(n.text)} <small>${esc(n.at)}</small></li>`).join('')}</ul>`;
}

// --- photos: attachments of the node ----------------------------------------------------------------------------------
const hasCamera = () => ctx.camera === true && typeof docodez.capturePhoto === 'function';

async function addPhoto(note: Note): Promise<void> {
  const file = hasCamera() ? await docodez.capturePhoto!() : await docodez.pickFile(['.jpg', '.jpeg', '.png', '.webp']);
  if (!file) return;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const name = `notes-${note.id}.${ext}`;
  await docodez.putAttachment(name, file.data);
  if (note.photo && note.photo !== name) await docodez.deleteAttachment?.(note.photo).catch(() => {});
  note.photo = name;
  render();
  scheduleSave();
}

async function removeNote(note: Note): Promise<void> {
  data.notes = data.notes.filter((n) => n !== note);
  if (note.photo) await docodez.deleteAttachment?.(note.photo).catch(() => {});
  render();
  scheduleSave();
}

// --- the screen -------------------------------------------------------------------------------------------------------
function render(): void {
  const list = $('list');
  list.innerHTML = '';
  if (!data.notes.length) {
    list.innerHTML = `<p class="empty">${esc(t.empty)}</p>`;
    return;
  }
  for (const note of data.notes) {
    const row = document.createElement('div');
    row.className = 'note';
    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = note.text;
    const at = document.createElement('small');
    at.textContent = note.at;
    text.appendChild(at);
    row.appendChild(text);
    if (note.photo) {
      const img = document.createElement('img');
      img.alt = '';
      void docodez.attachmentUrl(note.photo).then((url) => { img.src = url; });
      row.appendChild(img);
    }
    if (editable) {
      const photo = button(`📷 ${t.photo}`, () => void addPhoto(note));
      const remove = button('✕', () => void removeNote(note));
      remove.title = t.remove;
      row.append(photo, remove);
    }
    list.appendChild(row);
  }
}

function button(label: string, onclick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

let toastTimer = 0;
function toast(text: string): void {
  const box = $('toast');
  box.textContent = text;
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove('on'), 3000);
}

$('addInput').setAttribute('placeholder', t.placeholder);
$('addBtn').textContent = t.add;
$('viewNote').textContent = t.viewMode;
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>('addInput');
  const text = input.value.trim();
  if (!text) return;
  data.notes.unshift({ id: Date.now().toString(36), text, photo: null, at: new Date().toISOString().slice(0, 10) });
  input.value = '';
  render();
  scheduleSave();
});

// --- edit mode and theme ----------------------------------------------------------------------------------------------
function setEditable(value: boolean): void {
  editable = value;
  document.body.classList.toggle('editable', value);
  $('viewNote').hidden = value;
  render();
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.body.classList.toggle('dark', theme === 'dark');
}

docodez.on('modechange', (p) => setEditable(p.editable));
docodez.on('themechange', (p) => applyTheme(p.theme));
document.documentElement.lang = ctx.language;
applyTheme(ctx.theme);
setEditable(editable);
