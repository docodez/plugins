// Hojas de cálculo - plugin de Docodez (ver doc/04-plugins.md). TypeScript + SheetJS, compilado con Vite.
// Las planillas son archivos anexos al nodo (CSV, Excel .xlsx/.xls, LibreOffice .ods; se pueden anexar varios y se elige
// cuál ver arriba). Se ven y se editan las celdas; las hojas del libro son pestañas abajo. Cada cambio se guarda en el
// mismo anexo, en su formato. Los datos del plugin (JSON) guardan qué archivo y qué hoja se estaban viendo; la página de
// respaldo del nodo lleva la hoja como tabla (la indexa la búsqueda).
import type { DocodezContext } from '../../../sdk/docodez';
import { installDevDocodez } from '../../../sdk/docodez-dev';
import { createPicker } from '../../../sdk/picker';
import { FILE_TYPES, type Book, XLSX, addSheet, display, isSheetFile, load, multiSheet, newBook, removeSheet, renameSheet, save } from './book';
import { Grid } from './grid';
import './style.css';

// Fuera de Docodez (npm run dev) un window.docodez de prueba. En el plugin compilado esto no está.
if (import.meta.env.DEV) installDevDocodez('lynza.hojas');

const TEXT = {
  es: {
    open: 'Abrir archivo...', newBook: 'Libro nuevo', file: 'Archivo', sheet: 'Hoja', addSheet: 'Hoja nueva',
    empty: 'No hay planillas anexas a este nodo.', emptyEdit: 'Abrí un archivo (CSV, Excel, LibreOffice) o soltalo acá, o creá un libro nuevo.',
    loading: 'Cargando...', saving: 'Guardando...', saved: 'Guardado', error: 'No se pudo abrir: ', saveError: 'No se pudo guardar: ',
    deleteSheet: 'Borrar la hoja', confirmDelete: '¿Borrar?', rename: 'Doble clic para cambiar el nombre', book: 'Libro',
    formula: 'Fórmula o valor de la celda elegida',
  },
  en: {
    open: 'Open file...', newBook: 'New workbook', file: 'File', sheet: 'Sheet', addSheet: 'New sheet',
    empty: 'There are no spreadsheets attached to this node.', emptyEdit: 'Open a file (CSV, Excel, LibreOffice) or drop it here, or create a new workbook.',
    loading: 'Loading...', saving: 'Saving...', saved: 'Saved', error: 'Could not open: ', saveError: 'Could not save: ',
    deleteSheet: 'Delete the sheet', confirmDelete: 'Delete?', rename: 'Double-click to rename', book: 'Workbook',
    formula: 'Formula or value of the selected cell',
  },
  fr: {
    open: 'Ouvrir un fichier...', newBook: 'Nouveau classeur', file: 'Fichier', sheet: 'Feuille', addSheet: 'Nouvelle feuille',
    empty: "Aucun tableur n'est joint à ce nœud.", emptyEdit: 'Ouvrez un fichier (CSV, Excel, LibreOffice) ou déposez-le ici, ou créez un nouveau classeur.',
    loading: 'Chargement...', saving: 'Enregistrement...', saved: 'Enregistré', error: "Impossible d'ouvrir : ", saveError: "Impossible d'enregistrer : ",
    deleteSheet: 'Supprimer la feuille', confirmDelete: 'Supprimer ?', rename: 'Double-cliquez pour renommer', book: 'Classeur',
    formula: 'Formule ou valeur de la cellule sélectionnée',
  },
};

/** Lo que el plugin guarda en el nodo. */
interface SheetState {
  file: string | null;
  sheet: number;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const ctx: DocodezContext = await docodez.ready;
const t = TEXT[ctx.language] ?? TEXT.en;
const state: SheetState = { file: null, sheet: 0, ...((await docodez.getJSON<Partial<SheetState>>()) ?? {}) };

let book: Book | null = null;
let dirty = false;
let saveTimer = 0;
const status = (text: string) => { $('status').textContent = text; };

// --- grilla y barra de fórmulas --------------------------------------------------------------------------------------
const formula = $<HTMLInputElement>('formula');
formula.title = t.formula;
const grid = new Grid($('sheet'), {
  editable: () => ctx.editable,
  decimalComma: () => book?.csv?.decimalComma ?? false,
  onChange: () => { dirty = true; saveLater(); },
  onSelect: (address, rawValue) => {
    $('address').textContent = address;
    if (document.activeElement !== formula) formula.value = rawValue;
  },
});

formula.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const { r, c } = grid.selection;
    grid.setValue(r, c, formula.value);
    grid.select(r + 1, c);
    $('sheet').focus();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    $('sheet').focus();
    const { r, c } = grid.selection;
    grid.select(r, c); // vuelve a mostrar el valor de la celda
  }
});

// --- archivos ------------------------------------------------------------------------------------------------------
const filePicker = createPicker($('file'), t.file);
filePicker.onchange = (name) => void openFile(name);

async function sheetFiles(): Promise<string[]> {
  return (await docodez.listAttachments()).map((a) => a.name).filter(isSheetFile).sort((a, b) => a.localeCompare(b));
}

async function refreshFiles(select: string | null): Promise<string | null> {
  const files = await sheetFiles();
  const chosen = select && files.includes(select) ? select : state.file && files.includes(state.file) ? state.file : files[0] ?? null;
  filePicker.set(files, chosen);
  $('file').style.display = files.length > 0 ? '' : 'none';
  return chosen;
}

async function openFile(name: string | null, sheet?: number): Promise<void> {
  await flush();
  grid.cancelEdit();
  book = null;
  if (!name) {
    showEmpty(true);
    grid.setSheet(null);
    renderTabs();
    return;
  }

  status(t.loading);
  try {
    book = load(name, await docodez.getAttachment(name));
    const changedFile = state.file !== name;
    state.file = name;
    state.sheet = Math.min(Math.max(0, sheet ?? (changedFile ? 0 : state.sheet)), book.wb.SheetNames.length - 1);
    filePicker.set(await sheetFiles(), name);
    showEmpty(false);
    grid.setSheet(currentSheet());
    renderTabs();
    status('');
    if (ctx.editable && changedFile) void docodez.setJSON(state);
  } catch (e) {
    book = null;
    grid.setSheet(null);
    renderTabs();
    showEmpty(true);
    status(t.error + ((e as Error)?.message ?? e));
  }
}

const currentSheet = () => (book ? book.wb.Sheets[book.wb.SheetNames[state.sheet]] : null);

function showEmpty(empty: boolean): void {
  $('empty').style.display = empty ? '' : 'none';
  $('formulaBar').style.visibility = empty ? 'hidden' : '';
}

/** Agrega (o reemplaza) un archivo y lo abre. */
async function addFile(name: string, data: ArrayBuffer): Promise<void> {
  await flush();
  await docodez.putAttachment(name, data);
  await refreshFiles(name);
  await openFile(name, 0);
}

async function uniqueName(base: string, extension: string): Promise<string> {
  const existing = new Set((await docodez.listAttachments()).map((a) => a.name.toLowerCase()));
  let name = base + extension;
  for (let n = 2; existing.has(name.toLowerCase()); n++) name = `${base} ${n}${extension}`;
  return name;
}

// --- pestañas de las hojas -----------------------------------------------------------------------------------------
let confirmingDelete = -1;

function renderTabs(): void {
  const tabs = $('tabs');
  tabs.innerHTML = '';
  if (!book) return;
  book.wb.SheetNames.forEach((name, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab' + (i === state.sheet ? ' active' : '');
    tab.textContent = name;
    if (ctx.editable && multiSheet(book!)) tab.title = t.rename;
    tab.onclick = () => selectSheet(i);
    tab.ondblclick = () => startRename(tab, i);
    if (ctx.editable && i === state.sheet && book!.wb.SheetNames.length > 1) {
      const del = document.createElement('span');
      del.className = 'tab-del' + (confirmingDelete === i ? ' confirm' : '');
      del.textContent = confirmingDelete === i ? t.confirmDelete : '×';
      del.title = t.deleteSheet;
      del.onclick = (e) => {
        e.stopPropagation();
        if (confirmingDelete !== i) {
          confirmingDelete = i;
          renderTabs();
          return;
        }

        confirmingDelete = -1;
        if (book && removeSheet(book, i)) {
          state.sheet = Math.min(state.sheet, book.wb.SheetNames.length - 1);
          grid.setSheet(currentSheet());
          changed();
        }

        renderTabs();
      };
      tab.appendChild(del);
    }

    tabs.appendChild(tab);
  });

  if (ctx.editable && multiSheet(book)) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tab add';
    add.textContent = '+';
    add.title = t.addSheet;
    add.onclick = () => {
      if (!book) return;
      addSheet(book, `${t.sheet}${book.wb.SheetNames.length + 1}`);
      changed();
      selectSheet(book.wb.SheetNames.length - 1);
    };
    tabs.appendChild(add);
  }
}

function selectSheet(i: number): void {
  if (!book || i === state.sheet || i < 0 || i >= book.wb.SheetNames.length) return;
  grid.commitEdit();
  confirmingDelete = -1;
  state.sheet = i;
  grid.setSheet(currentSheet());
  renderTabs();
  if (ctx.editable) saveLater();
}

function startRename(tab: HTMLElement, i: number): void {
  if (!book || !ctx.editable || !multiSheet(book)) return;
  const input = document.createElement('input');
  input.className = 'tab-rename';
  input.value = book.wb.SheetNames[i];
  tab.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (apply: boolean) => {
    if (done) return;
    done = true;
    if (apply && book && renameSheet(book, i, input.value)) changed();
    renderTabs();
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  };
  input.onblur = () => finish(true);
}

// --- guardar en el nodo ----------------------------------------------------------------------------------------------
function changed(): void {
  dirty = true;
  saveLater();
}

function saveLater(): void {
  if (!ctx.editable) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveNow(), 700);
}

async function flush(): Promise<void> {
  clearTimeout(saveTimer);
  await saveNow();
}

async function saveNow(): Promise<void> {
  if (!ctx.editable) return;
  try {
    if (book && state.file && dirty) {
      status(t.saving);
      dirty = false;
      await docodez.putAttachment(state.file, save(book));
    }

    await docodez.setJSON(state);
    await docodez.setPreview(preview());
    if ($('status').textContent === t.saving) {
      status(t.saved);
      setTimeout(() => { if ($('status').textContent === t.saved) status(''); }, 1500);
    }
  } catch (e) {
    dirty = true;
    status(t.saveError + ((e as Error)?.message ?? e));
  }
}

/** La página de respaldo: la hoja que se está viendo como tabla (la indexa la búsqueda; la ve un Docodez sin el plugin). */
function preview(): string {
  const ws = currentSheet();
  let table = '';
  if (ws?.['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const rows = Math.min(range.e.r, 199), cols = Math.min(range.e.c, 25);
    for (let r = 0; r <= rows; r++) {
      let tr = '';
      for (let c = 0; c <= cols; c++) tr += `<td>${esc(display(ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined))}</td>`;
      table += `<tr>${tr}</tr>`;
    }

    table = `<table border="1" style="border-collapse:collapse">${table}</table>`;
    if (range.e.r > rows || range.e.c > cols) table += '<p>…</p>';
  }

  const sheetName = book ? book.wb.SheetNames[state.sheet] : '';
  return `<h2>${esc(ctx.nodeTitle)}</h2><p>${esc(t.file)}: ${esc(state.file ?? '-')}${sheetName ? ' · ' + esc(sheetName) : ''}</p>${table}`;
}

// --- interfaz ----------------------------------------------------------------------------------------------------------
$('open').textContent = t.open;
$('new').textContent = t.newBook;
$('open').onclick = async () => {
  const file = await docodez.pickFile(FILE_TYPES);
  if (file) await addFile(file.name, file.data);
};
$('new').onclick = async () => {
  const name = await uniqueName(t.book, '.xlsx');
  await addFile(name, save(newBook(t.sheet + '1')));
};

// Soltar un archivo sobre la hoja (modo edición).
const sheetArea = $('sheet');
sheetArea.addEventListener('dragover', (e) => {
  if (ctx.editable) {
    e.preventDefault();
    sheetArea.classList.add('drop');
  }
});
sheetArea.addEventListener('dragleave', () => sheetArea.classList.remove('drop'));
sheetArea.addEventListener('drop', async (e) => {
  sheetArea.classList.remove('drop');
  if (!ctx.editable) return;
  e.preventDefault();
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => isSheetFile(f.name));
  if (file) await addFile(file.name, await file.arrayBuffer());
});

function setEditable(editable: boolean): void {
  if (!editable) grid.commitEdit();
  ctx.editable = editable;
  document.body.classList.toggle('editable', editable);
  formula.readOnly = !editable;
  $('empty').textContent = editable ? t.emptyEdit : t.empty;
  renderTabs();
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.body.classList.toggle('dark', theme === 'dark');
}

docodez.on('modechange', (p) => setEditable(p.editable));
docodez.on('themechange', (p) => applyTheme(p.theme));
// Que no quede nada sin guardar si se cierra o se cambia de nodo enseguida después de escribir.
window.addEventListener('pagehide', () => void flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });

applyTheme(ctx.theme);
setEditable(ctx.editable);
await openFile(await refreshFiles(state.file), state.sheet);

// Para las pruebas automáticas.
(window as unknown as { __hojas: unknown }).__hojas = {
  get book() { return book; },
  get state() { return state; },
  get dirty() { return dirty; },
  grid,
  addFile,
  openFile,
  refreshFiles,
  flush,
  selectSheet,
  XLSX,
};
