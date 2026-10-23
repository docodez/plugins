// La grilla de una hoja: virtual (solo se dibujan las celdas que se ven: una hoja de miles de filas anda igual), con
// encabezados de filas y columnas, selección con el mouse o las flechas, edición en la celda (escribir reemplaza; F2 o
// doble clic edita lo que hay; Enter / Tab confirman y avanzan; Esc cancela), Supr borra, copiar y pegar bloques (TSV,
// como Excel) y ancho de columnas arrastrando el borde del encabezado.
import { XLSX, display, raw, setCell } from './book';

const ROW_HEIGHT = 24;
const DEFAULT_WIDTH = 96;

export interface GridOptions {
  editable: () => boolean;
  decimalComma: () => boolean;
  /** Algo cambió en la hoja (para guardar). */
  onChange: () => void;
  /** Se movió la selección (para la barra de fórmulas). */
  onSelect: (address: string, rawValue: string) => void;
}

export function columnName(c: number): string {
  let s = '';
  for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}

export class Grid {
  private ws: XLSX.WorkSheet | null = null;
  private widths: number[] = [];
  private rows = 0;
  private cols = 0;
  private sel = { r: 0, c: 0 };
  private editor: HTMLInputElement | null = null;
  private readonly scroller: HTMLDivElement;
  private readonly sizer: HTMLDivElement;
  private readonly cells: HTMLDivElement;
  private readonly colHeader: HTMLDivElement;
  private readonly rowHeader: HTMLDivElement;
  private frame = 0;

  constructor(private readonly host: HTMLElement, private readonly opts: GridOptions) {
    host.classList.add('grid');
    host.tabIndex = 0;
    host.innerHTML = '<div class="g-corner"></div><div class="g-colhdr"></div><div class="g-rowhdr"></div>' +
      '<div class="g-scroll"><div class="g-sizer"><div class="g-cells"></div></div></div>';
    this.scroller = host.querySelector('.g-scroll')!;
    this.sizer = host.querySelector('.g-sizer')!;
    this.cells = host.querySelector('.g-cells')!;
    this.colHeader = host.querySelector('.g-colhdr')!;
    this.rowHeader = host.querySelector('.g-rowhdr')!;
    this.scroller.addEventListener('scroll', () => this.schedule());
    new ResizeObserver(() => this.schedule()).observe(this.scroller);
    this.cells.addEventListener('mousedown', (e) => this.onCellMouseDown(e));
    this.cells.addEventListener('dblclick', (e) => {
      const at = this.cellAt(e);
      if (at) this.startEdit(true);
    });
    host.addEventListener('keydown', (e) => this.onKeyDown(e));
    host.addEventListener('copy', (e) => this.onCopy(e));
    host.addEventListener('paste', (e) => this.onPaste(e));
    this.colHeader.addEventListener('mousedown', (e) => this.onHeaderMouseDown(e));
  }

  setSheet(ws: XLSX.WorkSheet | null): void {
    this.cancelEdit();
    this.ws = ws;
    this.sel = { r: 0, c: 0 };
    this.widths = [];
    const cols = (ws?.['!cols'] ?? []) as XLSX.ColInfo[];
    cols.forEach((info, i) => {
      if (info?.hidden) this.widths[i] = 0;
      else if (info?.wpx) this.widths[i] = info.wpx;
      else if (info?.wch) this.widths[i] = Math.round(info.wch * 7 + 5);
    });
    this.scroller.scrollTo(0, 0);
    this.measure();
    this.render();
    this.notifySelect();
  }

  /** Lo que tiene la hoja + un margen para seguir escribiendo más abajo / más a la derecha. */
  private measure(): void {
    const range = this.ws?.['!ref'] ? XLSX.utils.decode_range(this.ws['!ref']) : { e: { r: -1, c: -1 } };
    this.rows = Math.max(range.e.r + 1 + 50, 100, this.sel.r + 20);
    this.cols = Math.max(range.e.c + 1 + 5, 26, this.sel.c + 5);
    this.sizer.style.width = this.colLeft(this.cols) + 'px';
    this.sizer.style.height = this.rows * ROW_HEIGHT + 'px';
  }

  private width(c: number): number {
    return this.widths[c] ?? DEFAULT_WIDTH;
  }

  private colLeft(c: number): number {
    let x = 0;
    for (let i = 0; i < c; i++) x += this.width(i);
    return x;
  }

  private schedule(): void {
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
  }

  private render(): void {
    const top = this.scroller.scrollTop, left = this.scroller.scrollLeft;
    const height = this.scroller.clientHeight, width = this.scroller.clientWidth;
    const r0 = Math.max(0, Math.floor(top / ROW_HEIGHT) - 2);
    const r1 = Math.min(this.rows, Math.ceil((top + height) / ROW_HEIGHT) + 2);
    let c0 = 0, x0 = 0;
    while (c0 < this.cols && x0 + this.width(c0) < left) x0 += this.width(c0++);
    const visibleCols: { c: number; x: number }[] = [];
    for (let c = c0, x = x0; c < this.cols && x < left + width + DEFAULT_WIDTH; x += this.width(c++)) {
      if (this.width(c) > 0) visibleCols.push({ c, x });
    }

    const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]!));
    let html = '';
    for (let r = r0; r < r1; r++) {
      for (const { c, x } of visibleCols) {
        const cell = this.ws?.[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        const text = this.shown(cell);
        const cls = 'g-cell' + (cell?.t === 'n' ? ' num' : '') + (cell?.f ? ' formula' : '') + (r === this.sel.r && c === this.sel.c ? ' sel' : '');
        html += `<div class="${cls}" data-r="${r}" data-c="${c}" style="top:${r * ROW_HEIGHT}px;left:${x}px;width:${this.width(c)}px">${esc(text)}</div>`;
      }
    }

    this.cells.innerHTML = html;
    let colHtml = '';
    for (const { c, x } of visibleCols) {
      colHtml += `<div class="g-ch${c === this.sel.c ? ' on' : ''}" data-c="${c}" style="left:${x - left}px;width:${this.width(c)}px">${columnName(c)}<span class="g-resize" data-c="${c}"></span></div>`;
    }

    this.colHeader.innerHTML = colHtml;
    let rowHtml = '';
    for (let r = r0; r < r1; r++) {
      rowHtml += `<div class="g-rh${r === this.sel.r ? ' on' : ''}" style="top:${r * ROW_HEIGHT - top}px">${r + 1}</div>`;
    }

    this.rowHeader.innerHTML = rowHtml;
    if (this.editor) this.placeEditor();
  }

  // --- selección --------------------------------------------------------------------------------------------------

  private cellAt(e: MouseEvent): { r: number; c: number } | null {
    const el = (e.target as HTMLElement).closest('.g-cell') as HTMLElement | null;
    return el ? { r: Number(el.dataset.r), c: Number(el.dataset.c) } : null;
  }

  private onCellMouseDown(e: MouseEvent): void {
    const at = this.cellAt(e);
    if (!at) return;
    this.commitEdit();
    this.select(at.r, at.c);
    this.host.focus({ preventScroll: true });
  }

  select(r: number, c: number): void {
    this.sel = { r: Math.max(0, r), c: Math.max(0, c) };
    if (this.sel.r >= this.rows - 10 || this.sel.c >= this.cols - 3) this.measure();
    this.reveal();
    this.render();
    this.notifySelect();
  }

  get selection(): { r: number; c: number } {
    return { ...this.sel };
  }

  private reveal(): void {
    const top = this.sel.r * ROW_HEIGHT, left = this.colLeft(this.sel.c), w = this.width(this.sel.c);
    const s = this.scroller;
    if (top < s.scrollTop) s.scrollTop = top;
    else if (top + ROW_HEIGHT > s.scrollTop + s.clientHeight) s.scrollTop = top + ROW_HEIGHT - s.clientHeight;
    if (left < s.scrollLeft) s.scrollLeft = left;
    else if (left + w > s.scrollLeft + s.clientWidth) s.scrollLeft = left + w - s.clientWidth;
  }

  private notifySelect(): void {
    const cell = this.ws?.[XLSX.utils.encode_cell(this.sel)] as XLSX.CellObject | undefined;
    this.opts.onSelect(columnName(this.sel.c) + (this.sel.r + 1), this.rawOf(cell));
  }

  /** Un CSV con coma decimal (el de Excel en español) muestra y edita los números con coma, como en el archivo. */
  private shown(cell: XLSX.CellObject | undefined): string {
    return this.opts.decimalComma() && cell?.t === 'n' && !cell.z ? String(cell.v).replace('.', ',') : display(cell);
  }

  private rawOf(cell: XLSX.CellObject | undefined): string {
    return this.opts.decimalComma() && cell?.t === 'n' && !cell.f ? String(cell.v).replace('.', ',') : raw(cell);
  }

  // --- edición ----------------------------------------------------------------------------------------------------

  /** Empieza a editar la celda elegida: con lo que tiene (F2, doble clic) o vacía (se empezó a escribir). */
  startEdit(keep: boolean, initial = ''): void {
    if (!this.ws || !this.opts.editable()) return;
    this.cancelEdit();
    const input = document.createElement('input');
    input.className = 'g-editor';
    input.spellcheck = false;
    input.value = keep ? this.rawOf(this.ws[XLSX.utils.encode_cell(this.sel)] as XLSX.CellObject | undefined) : initial;
    this.editor = input;
    this.sizer.appendChild(input); // fuera de .g-cells: esa capa se vuelve a dibujar al desplazar
    this.placeEditor();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    input.addEventListener('blur', () => this.commitEdit());
  }

  private placeEditor(): void {
    if (!this.editor) return;
    Object.assign(this.editor.style, {
      top: this.sel.r * ROW_HEIGHT + 'px', left: this.colLeft(this.sel.c) + 'px',
      width: Math.max(this.width(this.sel.c), 120) + 'px', height: ROW_HEIGHT + 'px',
    });
    if (!this.editor.isConnected) this.sizer.appendChild(this.editor);
  }

  get editing(): boolean {
    return this.editor != null;
  }

  commitEdit(): void {
    const input = this.editor;
    if (!input) return;
    this.editor = null;
    input.remove();
    this.setValue(this.sel.r, this.sel.c, input.value);
  }

  cancelEdit(): void {
    const input = this.editor;
    this.editor = null;
    input?.remove();
  }

  /** Pone un valor (desde la barra de fórmulas o al pegar). */
  setValue(r: number, c: number, text: string): void {
    if (!this.ws || !this.opts.editable()) return;
    const addr = XLSX.utils.encode_cell({ r, c });
    const before = this.rawOf(this.ws[addr] as XLSX.CellObject | undefined);
    if (before === text) return;
    setCell(this.ws, r, c, text, this.opts.decimalComma());
    this.measure();
    this.render();
    if (r === this.sel.r && c === this.sel.c) this.notifySelect();
    this.opts.onChange();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.ws) return;
    if (this.editor) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        this.commitEdit();
        this.move(e.key === 'Enter' ? (e.shiftKey ? -1 : 1) : 0, e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : 0);
        this.host.focus({ preventScroll: true });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelEdit();
        this.host.focus({ preventScroll: true });
      }
      return;
    }

    const page = Math.max(1, Math.floor(this.scroller.clientHeight / ROW_HEIGHT) - 1);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      Enter: [e.shiftKey ? -1 : 1, 0], Tab: [0, e.shiftKey ? -1 : 1], PageDown: [page, 0], PageUp: [-page, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      if (e.ctrlKey && e.key.startsWith('Arrow')) this.jump(moves[e.key]);
      else this.move(...moves[e.key]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.select(e.ctrlKey ? 0 : this.sel.r, 0);
    } else if (e.key === 'F2') {
      e.preventDefault();
      this.startEdit(true);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.setValue(this.sel.r, this.sel.c, '');
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && this.opts.editable()) {
      e.preventDefault();
      this.startEdit(false, e.key);
    }
  }

  private move(dr: number, dc: number): void {
    this.select(this.sel.r + dr, this.sel.c + dc);
  }

  /** Ctrl+flecha: al borde de lo escrito. */
  private jump([dr, dc]: [number, number]): void {
    const range = this.ws?.['!ref'] ? XLSX.utils.decode_range(this.ws['!ref']) : { e: { r: 0, c: 0 } };
    this.select(dr < 0 ? 0 : dr > 0 ? range.e.r : this.sel.r, dc < 0 ? 0 : dc > 0 ? range.e.c : this.sel.c);
  }

  // --- copiar y pegar ---------------------------------------------------------------------------------------------

  private onCopy(e: ClipboardEvent): void {
    if (this.editor || !this.ws) return;
    e.preventDefault();
    e.clipboardData?.setData('text/plain', this.shown(this.ws[XLSX.utils.encode_cell(this.sel)] as XLSX.CellObject | undefined));
  }

  /** Pegar texto: un bloque con tabulaciones y saltos de línea (lo que copia Excel) llena desde la celda elegida. */
  private onPaste(e: ClipboardEvent): void {
    if (this.editor || !this.ws || !this.opts.editable()) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    this.paste(text);
  }

  paste(text: string): void {
    if (!this.ws || !this.opts.editable()) return;
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
    lines.forEach((line, i) => line.split('\t').forEach((v, j) => setCell(this.ws!, this.sel.r + i, this.sel.c + j, v, this.opts.decimalComma())));
    this.measure();
    this.render();
    this.notifySelect();
    this.opts.onChange();
  }

  // --- ancho de columnas ------------------------------------------------------------------------------------------

  private onHeaderMouseDown(e: MouseEvent): void {
    const handle = (e.target as HTMLElement).closest('.g-resize') as HTMLElement | null;
    const header = (e.target as HTMLElement).closest('.g-ch') as HTMLElement | null;
    if (!handle) {
      if (header) this.select(this.sel.r, Number(header.dataset.c));
      return;
    }

    e.preventDefault();
    const c = Number(handle.dataset.c);
    const startX = e.clientX, startW = this.width(c);
    const onMove = (m: MouseEvent) => {
      this.widths[c] = Math.max(24, Math.round(startW + m.clientX - startX));
      this.measure();
      this.schedule();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (this.ws && this.opts.editable()) {
        const cols = ((this.ws['!cols'] ?? []) as XLSX.ColInfo[]).slice();
        cols[c] = { ...(cols[c] ?? {}), wpx: this.widths[c], wch: undefined };
        this.ws['!cols'] = cols;
        this.opts.onChange();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}
