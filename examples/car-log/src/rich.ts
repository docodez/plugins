// Un editor de texto con formato chiquito (negrita, cursiva, subrayado, listas, título, enlace) para las notas de las
// reparaciones, los viajes y las notas. Lo que se guarda pasa siempre por sanitize: solo etiquetas de texto, sin scripts ni
// estilos (lo pegado de una página web trae de todo).

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'SPAN', 'CODE', 'PRE', 'HR']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK']);

/** El HTML con solo lo permitido (las etiquetas desconocidas dejan su texto; los enlaces, solo http/https/mailto/tel). */
export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html ?? ''}</body>`, 'text/html');
  const clean = (node: Node, into: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        into.appendChild(document.createTextNode(child.textContent ?? ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const e = child as Element;
        if (DROP.has(e.tagName)) continue;
        if (!ALLOWED.has(e.tagName)) { clean(e, into); continue; }
        const out = document.createElement(e.tagName === 'STRONG' ? 'b' : e.tagName === 'EM' ? 'i' : e.tagName.toLowerCase());
        if (e.tagName === 'A') {
          const href = e.getAttribute('href') ?? '';
          if (/^(https?:|mailto:|tel:)/i.test(href.trim())) out.setAttribute('href', href.trim());
        }
        clean(e, out);
        into.appendChild(out);
      }
    }
  };
  const box = document.createElement('div');
  clean(doc.body, box);
  // Sin párrafos vacíos al final.
  return box.innerHTML.replace(/(<br>|<p><\/p>|<div><\/div>|<div><br><\/div>|\s)+$/g, '').trim();
}

/** El texto plano (para la vista previa de una fila y la búsqueda). */
export function plainText(html: string): string {
  const box = document.createElement('div');
  box.innerHTML = sanitize(html).replace(/<(br|\/p|\/div|\/li|\/h3|\/h4)>/g, '$&\n');
  return (box.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface RichTexts { bold: string; italic: string; underline: string; bullets: string; numbers: string; heading: string; link: string; linkPrompt: string; clear: string }

export interface RichEditor { element: HTMLElement; get html(): string; set html(v: string) }

/** El editor: una barra y un área editable. onChange se llama al escribir. ask: pedir la dirección de un enlace. */
export function createRichEditor(texts: RichTexts, html: string, onChange: () => void,
  ask: (title: string) => Promise<string | null>, placeholder = ''): RichEditor {
  const wrap = document.createElement('div');
  wrap.className = 'rich';
  const bar = document.createElement('div');
  bar.className = 'rich-bar';
  const area = document.createElement('div');
  area.className = 'rich-area';
  area.contentEditable = 'true';
  area.dataset.placeholder = placeholder;
  area.innerHTML = sanitize(html);
  let saved: Range | null = null;
  const remember = () => {
    const sel = getSelection();
    if (sel && sel.rangeCount && area.contains(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    area.focus();
    if (saved) { const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(saved); }
  };
  area.addEventListener('keyup', remember);
  area.addEventListener('mouseup', remember);
  area.addEventListener('input', () => { remember(); onChange(); });
  // Pegar: como texto con formato limpio (sin los estilos de la página de origen).
  area.addEventListener('paste', (e) => {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    const pasted = data.getData('text/html');
    if (pasted) document.execCommand('insertHTML', false, sanitize(pasted));
    else document.execCommand('insertText', false, data.getData('text/plain'));
  });
  const button = (label: string, title: string, run: () => void | Promise<void>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rich-btn';
    b.innerHTML = label;
    b.title = title;
    // Que el clic no le saque el foco (ni la selección) al texto.
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.onclick = async () => { await run(); onChange(); };
    bar.appendChild(b);
  };
  const exec = (cmd: string, value?: string) => () => { restore(); document.execCommand(cmd, false, value); remember(); };
  button('<b>B</b>', texts.bold, exec('bold'));
  button('<i>I</i>', texts.italic, exec('italic'));
  button('<u>U</u>', texts.underline, exec('underline'));
  button('H', texts.heading, () => {
    restore();
    const block = document.queryCommandValue('formatBlock').toLowerCase();
    document.execCommand('formatBlock', false, block === 'h3' ? 'p' : 'h3');
  });
  button('•', texts.bullets, exec('insertUnorderedList'));
  button('1.', texts.numbers, exec('insertOrderedList'));
  button('🔗', texts.link, async () => {
    const keep = saved;
    const url = await ask(texts.linkPrompt);
    saved = keep;
    if (!url) return;
    restore();
    const href = /^(https?:|mailto:|tel:)/i.test(url) ? url : 'https://' + url;
    if (getSelection()?.isCollapsed) document.execCommand('insertHTML', false, `<a href="${href.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`);
    else document.execCommand('createLink', false, href);
  });
  button('⌫', texts.clear, exec('removeFormat'));
  wrap.append(bar, area);
  return {
    element: wrap,
    get html() { return sanitize(area.innerHTML); },
    set html(v: string) { area.innerHTML = sanitize(v); },
  };
}
