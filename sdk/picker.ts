// Listas y selector de color dibujados en la página, para cualquier plugin (visor3d, hojas).
// Fase 9f, bug reportado: la lista nativa (<select>) de los modelos del visor 3D se abría en la esquina de arriba a la
// izquierda de la ventana (sobre el árbol). Con el visor integrado (WebView2 dentro de Avalonia) el navegador dibuja sus
// ventanitas nativas (<select>, <input type="color">, fechas) relativas a otra ventana. Dibujarlas en la propia página
// las deja siempre en su lugar, en todas las plataformas.

let openPopup: HTMLElement | null = null;

function closeOpen(): void {
  openPopup?.setAttribute('hidden', '');
  openPopup = null;
}

document.addEventListener('pointerdown', (e) => {
  if (openPopup && !openPopup.parentElement?.contains(e.target as Node)) closeOpen();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOpen();
});

function toggle(popup: HTMLElement): void {
  if (openPopup === popup) {
    closeOpen();
    return;
  }

  closeOpen();
  popup.removeAttribute('hidden');
  openPopup = popup;
}

export interface Picker {
  /** Las opciones y la elegida. */
  set(items: string[], value: string | null): void;
  readonly value: string | null;
  onchange: ((value: string) => void) | null;
}

/** Una lista desplegable en <paramref name="host"/> (un div vacío). */
export function createPicker(host: HTMLElement, label: string): Picker {
  host.classList.add('pick');
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-label', label);
  const list = document.createElement('div');
  list.className = 'pick-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('hidden', '');
  host.append(button, list);

  let items: string[] = [];
  let value: string | null = null;
  const picker: Picker = {
    set(newItems, newValue) {
      items = newItems;
      value = newValue;
      button.textContent = `${value ?? '-'} ▾`;
      list.innerHTML = '';
      for (const item of items) {
        const option = document.createElement('div');
        option.className = 'pick-item' + (item === value ? ' selected' : '');
        option.setAttribute('role', 'option');
        option.textContent = item;
        option.onclick = () => {
          closeOpen();
          if (item !== value) {
            picker.set(items, item);
            picker.onchange?.(item);
          }
        };
        list.appendChild(option);
      }
    },
    get value() { return value; },
    onchange: null,
  };
  button.onclick = () => toggle(list);
  return picker;
}

const PALETTE = [
  '#b0bec5', '#78909c', '#455a64', '#263238', '#ffffff', '#e0e0e0', '#9e9e9e', '#212121',
  '#ef9a9a', '#e53935', '#b71c1c', '#ffcc80', '#fb8c00', '#e65100', '#fff59d', '#fdd835',
  '#a5d6a7', '#43a047', '#1b5e20', '#90caf9', '#1e88e5', '#0d47a1', '#ce93d8', '#8e24aa',
];

/** Un botón con el color elegido que abre una paleta (y un campo #rrggbb). */
export function createColorPicker(host: HTMLElement, label: string, initial: string, onchange: (color: string) => void): { set(color: string): void } {
  host.classList.add('pick');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pick-color';
  button.setAttribute('aria-label', label);
  const popup = document.createElement('div');
  popup.className = 'pick-list pick-palette';
  popup.setAttribute('hidden', '');
  host.append(button, popup);

  const set = (color: string) => { button.style.background = color; button.dataset.color = color; };
  const choose = (color: string) => { set(color); closeOpen(); onchange(color); };
  for (const color of PALETTE) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'pick-swatch';
    swatch.style.background = color;
    swatch.title = color;
    swatch.onclick = () => choose(color);
    popup.appendChild(swatch);
  }

  const hex = document.createElement('input');
  hex.className = 'pick-hex';
  hex.placeholder = '#rrggbb';
  hex.onkeydown = (e) => {
    if (e.key === 'Enter' && /^#?[0-9a-f]{6}$/i.test(hex.value.trim())) choose('#' + hex.value.trim().replace('#', '').toLowerCase());
  };
  popup.appendChild(hex);
  button.onclick = () => toggle(popup);
  set(initial);
  return { set };
}
