// La calculadora de la barra: una ventanita con teclado (y el teclado de verdad). Evalúa con un analizador propio (sin
// eval): números, + − × ÷, %, paréntesis y el signo.

/** Evalúa la expresión; null si no está completa o no se puede. "%": 50% = 0.5; "200+10%" = 220 (como las calculadoras). */
export function evaluate(expr: string): number | null {
  const src = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  let i = 0;
  const peek = () => src[i];
  function number(): number | null {
    const m = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\./i.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function factor(): number | null {
    if (peek() === '-') { i++; const v = factor(); return v == null ? null : -v; }
    if (peek() === '+') { i++; return factor(); }
    let v: number | null;
    if (peek() === '(') {
      i++;
      v = sum();
      if (peek() === ')') i++;
    } else {
      v = number();
    }
    if (v != null && peek() === '%') { i++; v = v / 100; }
    return v;
  }
  function product(): number | null {
    let v = factor();
    while (v != null && (peek() === '*' || peek() === '/')) {
      const op = src[i++];
      const r = factor();
      if (r == null) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function sum(): number | null {
    let v = product();
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const start = i;
      const r = product();
      if (r == null) return null;
      // "200+10%": el porcentaje es del número de la izquierda.
      const isPercent = /^[\d.]+%$/.test(src.slice(start, i));
      const rr = isPercent ? v * r : r;
      v = op === '+' ? v + rr : v - rr;
    }
    return v;
  }
  if (!src) return null;
  const v = sum();
  return i === src.length && v != null && isFinite(v) ? v : null;
}

export const formatNumber = (v: number) => {
  const r = Math.round(v * 1e10) / 1e10;
  return Math.abs(r) >= 1e15 ? r.toExponential(6) : String(r);
};

const KEYS = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '(', '0', '.', ')', '='];

export interface CalcTexts { title: string; close: string; copy: string; history: string; historyEmpty: string; historyClear: string; back: string }

/** Fase 11e: la historia de las cuentas (la guarda quien la crea, en los datos de la app: es de todas las listas). */
export interface CalcHistory {
  list(): { expr: string; result: string }[];
  add(expr: string, result: string): void;
  clear(): void;
}

const POS_KEY = 'compras.calc.pos';

/** La calculadora, dentro de <host>. Se mueve arrastrando su barra de título (como los diálogos de Docodez). */
export function createCalculator(host: HTMLElement, texts: CalcTexts, history?: CalcHistory) {
  host.classList.add('calc');
  host.innerHTML = `<div class="calc-head"><b>${texts.title}</b><span class="calc-head-buttons">` +
    (history ? `<button type="button" class="calc-hbtn" title="${texts.history}">🕘 ${texts.history}</button>` : '') +
    `<button type="button" class="calc-x" aria-label="${texts.close}">✕</button></span></div>
    <div class="calc-body"><div class="calc-hist"></div><input class="calc-display" inputmode="none" autocomplete="off" spellcheck="false"><div class="calc-result"></div>
    <div class="calc-keys"></div></div>
    <div class="calc-history" hidden><div class="calc-history-list"></div>
    <div class="calc-history-buttons"><button type="button" class="btn calc-history-clear">${texts.historyClear}</button><button type="button" class="btn primary calc-history-back">${texts.back}</button></div></div>`;
  const display = host.querySelector<HTMLInputElement>('.calc-display')!;
  const result = host.querySelector<HTMLElement>('.calc-result')!;
  const hist = host.querySelector<HTMLElement>('.calc-hist')!;
  const keys = host.querySelector<HTMLElement>('.calc-keys')!;
  const head = host.querySelector<HTMLElement>('.calc-head')!;
  const body = host.querySelector<HTMLElement>('.calc-body')!;
  const historyPanel = host.querySelector<HTMLElement>('.calc-history')!;
  const historyList = host.querySelector<HTMLElement>('.calc-history-list')!;
  const update = () => {
    const v = evaluate(display.value);
    result.textContent = v == null || display.value === formatNumber(v) ? '' : '= ' + formatNumber(v);
  };
  const press = (k: string) => {
    if (k === 'C') { display.value = ''; }
    else if (k === '⌫') { display.value = display.value.slice(0, -1); }
    else if (k === '=') {
      const v = evaluate(display.value);
      if (v != null) {
        const expr = display.value.trim();
        hist.textContent = expr + ' = ' + formatNumber(v);
        // Fase 11e: a la historia (un número solo no es una cuenta).
        if (history && expr !== formatNumber(v)) history.add(expr, formatNumber(v));
        display.value = formatNumber(v);
      }
    } else { display.value += k; }
    update();
  };
  for (const k of KEYS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k;
    b.className = 'calc-key' + (/[÷×−+=%]/.test(k) ? ' op' : '') + (k === '=' ? ' eq' : '');
    b.onclick = () => press(k);
    keys.appendChild(b);
  }
  display.addEventListener('input', update);
  display.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); press('='); }
    else if (e.key === 'Escape') { host.hidden = true; }
  });
  host.querySelector<HTMLButtonElement>('.calc-x')!.onclick = () => { host.hidden = true; };

  // --- Fase 11e: la historia ---------------------------------------------------------------------------------------------
  const showHistory = (on: boolean) => {
    historyPanel.hidden = !on;
    body.hidden = on;
    // Cambia de alto: que siga entera en la pantalla.
    if (saved && !host.hidden) saved = place(saved.x, saved.y);
    if (!on || !history) return;
    historyList.innerHTML = '';
    const entries = history.list();
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'calc-history-empty';
      empty.textContent = texts.historyEmpty;
      historyList.appendChild(empty);
    }
    for (const entry of entries) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'calc-history-item';
      const expr = document.createElement('span');
      expr.textContent = entry.expr;
      const res = document.createElement('b');
      res.textContent = '= ' + entry.result;
      row.append(expr, res);
      // Elegir una cuenta la vuelve a poner en la calculadora (para seguirla o corregirla).
      row.onclick = () => {
        display.value = entry.expr;
        hist.textContent = '';
        update();
        showHistory(false);
        if (!matchMedia('(pointer: coarse)').matches) display.focus();
      };
      historyList.appendChild(row);
    }
  };
  host.querySelector<HTMLButtonElement>('.calc-hbtn')?.addEventListener('click', () => showHistory(historyPanel.hidden));
  host.querySelector<HTMLButtonElement>('.calc-history-back')!.onclick = () => showHistory(false);
  host.querySelector<HTMLButtonElement>('.calc-history-clear')!.onclick = () => { history?.clear(); showHistory(true); };

  // --- Fase 11e: moverla arrastrando la barra de título -------------------------------------------------------------------
  // El puntero se captura recién cuando empieza a moverse: así los botones de la barra siguen recibiendo el clic. Hasta
  // entonces se escucha en el documento (el mouse puede salir de la barra con el primer movimiento).
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - host.offsetWidth)),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - host.offsetHeight)),
  });
  const place = (x: number, y: number) => {
    const p = clamp(x, y);
    host.style.left = p.x + 'px';
    host.style.top = p.y + 'px';
    host.style.right = 'auto';
    return p;
  };
  let saved: { x: number; y: number } | null = null;
  try { saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch { /* sin almacenamiento */ }
  let drag: { id: number; dx: number; dy: number; sx: number; sy: number; moving: boolean } | null = null;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button') || e.button !== 0) return;
    const r = host.getBoundingClientRect();
    drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moving: false };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moving) {
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
      drag.moving = true;
      head.setPointerCapture(e.pointerId);
      host.classList.add('dragging');
    }
    e.preventDefault();
    saved = place(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moving) {
      host.classList.remove('dragging');
      try { localStorage.setItem(POS_KEY, JSON.stringify(saved)); } catch { /* sin almacenamiento */ }
    }
    drag = null;
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  // Si la ventana se achica (girar el teléfono), que no quede afuera.
  window.addEventListener('resize', () => { if (saved && !host.hidden) saved = place(saved.x, saved.y); });

  return {
    open() {
      host.hidden = false;
      showHistory(false);
      if (saved) saved = place(saved.x, saved.y);
      if (!matchMedia('(pointer: coarse)').matches) display.focus();
    },
    toggle() { if (host.hidden) this.open(); else host.hidden = true; },
    press,
    showHistory,
    get value() { return display.value; },
  };
}
