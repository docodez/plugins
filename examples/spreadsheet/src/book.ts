// Leer y escribir los libros (SheetJS) y lo de las celdas. Excel (.xlsx, .xls) y LibreOffice (.ods) van y vuelven en
// su formato; los CSV se leen y escriben acá (separador, coma decimal, codificación y ceros a la izquierda como venían).
import * as XLSX from 'xlsx';

export type Kind = 'csv' | 'tsv' | 'xlsx' | 'xls' | 'ods';

export const FILE_TYPES = ['.csv', '.tsv', '.xlsx', '.xls', '.ods'];

export interface CsvInfo {
  delimiter: string;
  /** El separador de decimales es la coma (CSV con ";" de Excel en español). */
  decimalComma: boolean;
  bom: boolean;
  latin1: boolean;
}

export interface Book {
  wb: XLSX.WorkBook;
  kind: Kind;
  csv?: CsvInfo;
}

export const ext = (name: string) => (name.match(/\.[^.]+$/) ?? [''])[0].toLowerCase();
export const isSheetFile = (name: string) => FILE_TYPES.includes(ext(name));

export function kindOf(name: string): Kind {
  const e = ext(name).slice(1);
  return (['csv', 'tsv', 'xlsx', 'xls', 'ods'].includes(e) ? e : 'xlsx') as Kind;
}

/** Si el libro puede tener varias hojas (un CSV es una sola). */
export const multiSheet = (book: Book) => book.kind !== 'csv' && book.kind !== 'tsv';

// --- abrir ---------------------------------------------------------------------------------------------------------

export function load(name: string, data: ArrayBuffer): Book {
  const kind = kindOf(name);
  if (kind === 'csv' || kind === 'tsv') {
    const { text, bom, latin1 } = decodeText(data);
    const delimiter = kind === 'tsv' ? '\t' : detectDelimiter(text);
    const rows = parseCsv(text, delimiter);
    const decimalComma = delimiter === ';' || (delimiter === '\t' && looksDecimalComma(rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows.map((r) => r.map((v) => typed(v, decimalComma)))), stem(name).slice(0, 31) || 'Hoja1');
    return { wb, kind, csv: { delimiter, decimalComma, bom, latin1 } };
  }

  const wb = XLSX.read(new Uint8Array(data), { type: 'array', cellFormula: true, cellNF: true, cellStyles: true });
  if (wb.SheetNames.length === 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), 'Hoja1');
  return { wb, kind };
}

/** Un libro nuevo con una hoja vacía. */
export function newBook(sheetName: string): Book {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), sheetName);
  return { wb, kind: 'xlsx' };
}

// --- guardar -------------------------------------------------------------------------------------------------------

export function save(book: Book): ArrayBuffer {
  if (book.kind === 'csv' || book.kind === 'tsv') {
    const info = book.csv ?? { delimiter: book.kind === 'tsv' ? '\t' : ',', decimalComma: false, bom: false, latin1: false };
    const ws = book.wb.Sheets[book.wb.SheetNames[0]];
    const text = toCsv(sheetRows(ws), info);
    if (info.latin1) {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) < 256 ? text.charCodeAt(i) : 63; // '?'
      return bytes.buffer;
    }

    const bytes = new TextEncoder().encode((info.bom ? '﻿' : '') + text);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  const bookType: XLSX.BookType = book.kind === 'xls' ? 'biff8' : book.kind;
  return XLSX.write(book.wb, { bookType, type: 'array', compression: true, cellStyles: true }) as ArrayBuffer;
}

/** Las filas de una hoja como valores (para el CSV): el número como número, el resto como lo que se ve. */
function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  if (!ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const rows: unknown[][] = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cell == null ? '' : cell.f ? '=' + cell.f : cell.t === 'n' && !cell.z ? cell.v : cell.t === 'b' ? (cell.v ? 'TRUE' : 'FALSE') : display(cell));
    }

    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].every((v) => v === '')) rows.pop();
  return rows;
}

// --- CSV ------------------------------------------------------------------------------------------------------------

function decodeText(data: ArrayBuffer): { text: string; bom: boolean; latin1: boolean } {
  const bytes = new Uint8Array(data);
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bom ? bytes.subarray(3) : bytes), bom, latin1: false };
  } catch {
    // No es UTF-8: un CSV viejo de Excel en Windows (Latin-1 / Windows-1252).
    return { text: new TextDecoder('windows-1252').decode(bytes), bom: false, latin1: true };
  }
}

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const count = (d: string) => firstLines.split(d).length - 1;
  const candidates = [';', ',', '\t', '|'].map((d) => ({ d, n: count(d) }));
  candidates.sort((a, b) => b.n - a.n);
  return candidates[0].n > 0 ? candidates[0].d : ',';
}

function looksDecimalComma(rows: string[][]): boolean {
  let comma = 0, dot = 0;
  for (const row of rows.slice(0, 50)) for (const v of row) {
    if (/^-?\d+,\d+$/.test(v)) comma++;
    if (/^-?\d+\.\d+$/.test(v)) dot++;
  }
  return comma > dot;
}

/** CSV con comillas ("a ""b"" c", saltos de línea adentro). */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { quoted = true; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function toCsv(rows: unknown[][], info: CsvInfo): string {
  const cell = (v: unknown) => {
    let s = typeof v === 'number' ? (info.decimalComma ? String(v).replace('.', ',') : String(v)) : String(v ?? '');
    if (s.includes(info.delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return rows.map((r) => r.map(cell).join(info.delimiter)).join('\r\n') + (rows.length ? '\r\n' : '');
}

/** El texto de un CSV como valor de celda: número (sin perder ceros a la izquierda), verdadero/falso o texto. */
function typed(v: string, decimalComma: boolean): string | number | boolean {
  const t = v.trim();
  if (t === '') return v;
  const number = decimalComma ? /^-?\d+(,\d+)?$/ : /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
  if (number.test(t) && !/^-?0\d/.test(t)) return Number(decimalComma ? t.replace(',', '.') : t);
  if (/^(true|false|verdadero|falso)$/i.test(t)) return /^(true|verdadero)$/i.test(t);
  return v;
}

// --- celdas ---------------------------------------------------------------------------------------------------------

/** Lo que se ve en la celda (con su formato: fechas, porcentajes, decimales...). */
export function display(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  if (cell.t === 'e') return cell.w ?? '#ERR';
  if (cell.f && (cell.v === undefined || cell.v === '')) return '=' + cell.f; // fórmula nueva: sin resultado calculado
  if (cell.w != null) return cell.w;
  try {
    return XLSX.utils.format_cell(cell);
  } catch {
    return String(cell.v ?? '');
  }
}

/** Lo que se edita: la fórmula ("=A1+B1") o el valor. */
export function raw(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  if (cell.f) return '=' + cell.f;
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE';
  if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z as string)) return display(cell); // fecha: como se ve
  if (cell.t === 'n') return String(cell.v);
  return String(cell.v ?? '');
}

/** Pone lo escrito en la celda (r, c): "" la vacía, "=..." es una fórmula, un número, TRUE/FALSE, o texto. */
export function setCell(ws: XLSX.WorkSheet, r: number, c: number, input: string, decimalComma = false): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  const old = ws[addr] as XLSX.CellObject | undefined;
  if (input === '') {
    delete ws[addr];
    return;
  }

  let cell: XLSX.CellObject;
  const value = typed(input, decimalComma);
  if (input.startsWith('=') && input.length > 1) {
    cell = { t: 's', v: '', f: input.slice(1) };
  } else if (typeof value === 'number') {
    cell = { t: 'n', v: value };
    if (old?.z && !XLSX.SSF.is_date(old.z as string)) cell.z = old.z; // conserva el formato (decimales, %, moneda)
  } else if (typeof value === 'boolean') {
    cell = { t: 'b', v: value };
  } else {
    cell = { t: 's', v: input };
  }

  if (old?.s) cell.s = old.s;
  ws[addr] = cell;
  extendRef(ws, r, c);
}

export function extendRef(ws: XLSX.WorkSheet, r: number, c: number): void {
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  range.e.r = Math.max(range.e.r, r);
  range.e.c = Math.max(range.e.c, c);
  ws['!ref'] = XLSX.utils.encode_range(range);
}

export function addSheet(book: Book, name: string): string {
  let unique = name, n = 2;
  while (book.wb.SheetNames.includes(unique)) unique = `${name} ${n++}`;
  XLSX.utils.book_append_sheet(book.wb, XLSX.utils.aoa_to_sheet([[]]), unique);
  return unique;
}

/** Cambia el nombre de una hoja (Excel: hasta 31 caracteres, sin \ / ? * [ ] :). False si no se puede. */
export function renameSheet(book: Book, index: number, name: string): boolean {
  const clean = name.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31);
  const old = book.wb.SheetNames[index];
  if (!clean || (clean !== old && book.wb.SheetNames.includes(clean))) return false;
  book.wb.Sheets[clean] = book.wb.Sheets[old];
  if (clean !== old) delete book.wb.Sheets[old];
  book.wb.SheetNames[index] = clean;
  return true;
}

export function removeSheet(book: Book, index: number): boolean {
  if (book.wb.SheetNames.length <= 1) return false;
  const [name] = book.wb.SheetNames.splice(index, 1);
  delete book.wb.Sheets[name];
  return true;
}

const stem = (name: string) => name.replace(/\.[^.]+$/, '');

export { XLSX };
