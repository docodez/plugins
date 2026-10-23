// Shopping list - Docodez plugin (see doc/04-plugins.md and README.md). TypeScript, built with Vite.
// - The LIST (items, quantities, notes, photos, prices) is stored in the node: docodez.getJSON / setJSON; photos as attachments.
// - The CATALOGS (groups and items to pick quickly: grocery, hardware...) belong to the APP, not the document:
//   docodez.getAppJSON / setAppJSON (API 2). Each list item carries its group's name and emoji, so a list opened in
//   another Docodez still makes sense, and it offers to add whatever is missing to that user's catalog.
import type { DocodezContext } from '../../../sdk/docodez';
import { installDevDocodez } from '../../../sdk/docodez-dev';
import { createPicker, type Picker } from '../../../sdk/picker';
import { createCalculator } from './calc';
import { TEXTS } from './i18n';
import { CALC_HISTORY_MAX,
  type AppStore, type Catalog, type CatalogGroup, type ListItem, type Offer, type Shop, type ShoppingList, type Sum,
  UNITS, addToCatalog, bestOffer, catalogFromSeed, catalogOf, compareUnit, emptyCatalog, findGroup, findProduct, findShop, frequent,
  groupOrder, itemCost, itemTax, missingInCatalog, money, newId, norm, normalizeList, normalizeStore, parseNum, parseQuick, qtyText,
  rememberGroup, rememberShop, searchProducts, shopOrder, sum, taxRateFor, taxableIn, unitPrice, usedOffer,
} from './model';
import { type SeedId, SEEDS, seedName } from './seed';
import './style.css';

if (import.meta.env.DEV) installDevDocodez('lynza.compras');

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const ctx: DocodezContext = await docodez.ready;
const lang = (['es', 'en', 'fr'] as const).includes(ctx.language) ? ctx.language : 'en';
const t = TEXTS[lang];
const hasAppData = typeof docodez.getAppJSON === 'function'; // an old Docodez (API 1) does not have it
let editable = ctx.editable;

let store: AppStore = normalizeStore(hasAppData ? await docodez.getAppJSON().catch(() => null) : null, lang);
let list: ShoppingList = normalizeList(await docodez.getJSON().catch(() => null));
let catalog: Catalog | null = catalogOf(store, list);

/** The currency: the list's, else the one in settings. */
const cur = () => list.currency || store.settings.currency || '$';
/** Phase 9l: a store's tax (%). */
const rateOf = (shop: string) => taxRateFor(store, shop);
/** Phase 9l: the store picked at the top (new items go to that store), or null. */
const currentShop = (): Shop | null => store.shops.find((x) => x.id === store.lastShop) ?? null;
const shopEmoji = (name: string) => findShop(store, name)?.emoji || list.shops.find((x) => norm(x.name) === norm(name))?.emoji || '🏪';

// --- saving --------------------------------------------------------------------------------------------------------------
let saveTimer = 0;
let storeTimer = 0;

function scheduleSave(): void {
  if (!editable) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 500);
}

async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = 0;
  if (!editable) return;
  try {
    await docodez.setJSON(list);
    await docodez.setPreview(preview());
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
  try {
    await docodez.setAppJSON(store);
  } catch (e) {
    toast(t.saveError + (e as Error).message);
  }
}

// The first time, the starter catalog is saved in the app data.
if (hasAppData && !(await docodez.getAppData().catch(() => null))) void saveStoreNow();

// --- toasts --------------------------------------------------------------------------------------------------------------
let toastTimer = 0;
function toast(text: string): void {
  const box = $('toast');
  box.textContent = text;
  box.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove('on'), 2200);
}

// --- in-page dialogs (the browser's prompt/confirm do not work well inside Docodez) ---------------------------------------
interface Field { label: string; value?: string; placeholder?: string; kind?: 'text' | 'choice' | 'multi'; choices?: string[]; values?: string[]; inputMode?: string }

function dialog(title: string, fields: Field[], okText = t.ok, danger = false): Promise<string[] | null> {
  return new Promise((resolve) => {
    const modal = $('modal');
    modal.innerHTML = '';
    const box = el('form', 'modal-box');
    box.appendChild(el('h3', '', title));
    const inputs: (HTMLInputElement | null)[] = [];
    const choiceValues: string[] = [];
    fields.forEach((f, i) => {
      const label = el(f.kind === 'choice' || f.kind === 'multi' ? 'div' : 'label', 'field');
      if (f.label) label.appendChild(el('span', '', f.label));
      if (f.kind === 'multi') {
        // Phase 9l: several at once (a store's catalogs); returns the chosen ones separated by \n.
        const group = el('div', 'choices');
        const chosen = new Set(f.values ?? []);
        choiceValues[i] = [...chosen].join('\n');
        for (const c of f.choices!) {
          const b = el('button', 'choice' + (chosen.has(c) ? ' on' : ''), c) as HTMLButtonElement;
          b.type = 'button';
          b.onclick = () => {
            if (chosen.has(c)) chosen.delete(c); else chosen.add(c);
            b.classList.toggle('on', chosen.has(c));
            choiceValues[i] = f.choices!.filter((x) => chosen.has(x)).join('\n');
          };
          group.appendChild(b);
        }
        if (!f.choices!.length) group.appendChild(el('span', 'muted', '—'));
        label.appendChild(group);
        inputs.push(null);
      } else if (f.kind === 'choice') {
        const group = el('div', 'choices');
        choiceValues[i] = f.value ?? f.choices![0];
        for (const c of f.choices!) {
          const b = el('button', 'choice' + (c === choiceValues[i] ? ' on' : ''), c) as HTMLButtonElement;
          b.type = 'button';
          b.onclick = () => { choiceValues[i] = c; group.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === b)); };
          group.appendChild(b);
        }
        label.appendChild(group);
        inputs.push(null);
      } else {
        const input = el('input') as HTMLInputElement;
        input.value = f.value ?? '';
        input.placeholder = f.placeholder ?? '';
        input.autocomplete = 'off';
        if (f.inputMode) input.inputMode = f.inputMode;
        label.appendChild(input);
        inputs.push(input);
      }
      box.appendChild(label);
    });
    const buttons = el('div', 'modal-buttons');
    const cancel = el('button', 'btn', t.cancel) as HTMLButtonElement;
    cancel.type = 'button';
    const ok = el('button', 'btn primary' + (danger ? ' danger' : ''), okText) as HTMLButtonElement;
    ok.type = 'submit';
    buttons.append(cancel, ok);
    box.appendChild(buttons);
    modal.appendChild(box);
    modal.hidden = false;
    const finish = (result: string[] | null) => { modal.hidden = true; modal.innerHTML = ''; modalClose = null; resolve(result); };
    modalClose = () => finish(null);
    cancel.onclick = () => finish(null);
    box.onsubmit = (e) => { e.preventDefault(); finish(fields.map((f, i) => (f.kind === 'choice' || f.kind === 'multi' ? choiceValues[i] : inputs[i]!.value.trim()))); };
    const first = inputs.find((x) => x);
    if (first) { first.focus(); first.select(); } else ok.focus();
  });
}

let modalClose: (() => void) | null = null;
const confirmBox = async (text: string, okText = t.ok, danger = false) => (await dialog(text, [], okText, danger)) != null;
const askText = async (title: string, label: string, value = '') => (await dialog(title, [{ label, value }]))?.[0] ?? null;

// --- the list ------------------------------------------------------------------------------------------------------------
const groupEmoji = (name: string) =>
  findGroup(catalog, name)?.emoji || list.groups.find((g) => norm(g.name) === norm(name))?.emoji || (name ? '•' : '🛒');

function addItem(name: string, group: string, emoji: string, qty: number | null, unit: string): ListItem | null {
  if (!editable) { toast(t.viewMode); return null; }
  name = name.trim();
  if (!name) return null;
  const existing = list.items.find((i) => norm(i.name) === norm(name));
  if (existing) {
    if (existing.done) existing.done = false;
    else if (qty != null && (!unit || unit === existing.unit)) existing.qty = (existing.qty ?? 0) + qty;
    else if (qty == null && !existing.unit) existing.qty = (existing.qty ?? 1) + 1;
    toast(t.alreadyIn(existing.name));
    commit(existing.id);
    return existing;
  }

  const shop = currentShop();
  const item: ListItem = { id: newId(), name, group, emoji, qty, unit, note: '', photos: [], done: false, offers: [], chosen: null, added: Date.now(),
    shop: shop?.name ?? '', taxable: taxableIn(catalog, group, name) };
  list.items.push(item);
  rememberGroup(list, group, emoji);
  if (shop) rememberShop(list, shop.name, shop.emoji);
  if (catalog) {
    list.catalogId = catalog.id;
    list.catalogName = catalog.name;
    const found = findProduct(catalog, name);
    if (found) { found.product.uses++; saveStore(); }
  }

  toast(t.added(name));
  commit(item.id);
  return item;
}

/** Something changed in the list: save and redraw. */
function commit(flashId?: string): void {
  scheduleSave();
  renderList();
  renderPanel();
  if (flashId) {
    const row = document.querySelector<HTMLElement>(`.item[data-id="${flashId}"]`);
    if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'nearest' }); setTimeout(() => row.classList.remove('flash'), 900); }
  }
}

function renderList(): void {
  const main = $('list');
  main.innerHTML = '';
  if (list.items.length === 0) {
    main.appendChild(el('div', 'empty', editable ? `${t.empty} ${t.emptyEdit}` : t.empty));
  }

  const byShop = list.view === 'shop';
  const groupIndex = new Map(groupOrder(list, catalog).map((g, i) => [norm(g), i]));
  const sections = byShop ? shopOrder(list, store) : groupOrder(list, catalog);
  for (const key of sections) {
    const items = list.items.filter((i) => norm(byShop ? i.shop : i.group) === norm(key));
    const shown = items.filter((i) => !list.hideDone || !i.done)
      .sort((a, b) => Number(a.done) - Number(b.done) ||
        (byShop ? (groupIndex.get(norm(a.group)) ?? 0) - (groupIndex.get(norm(b.group)) ?? 0) : 0) || a.added - b.added);
    if (shown.length === 0) continue;
    const section = el('section', 'group');
    const head = el('h2', 'group-head');
    const emoji = byShop ? (key ? shopEmoji(key) : '🛒') : groupEmoji(key);
    const title = byShop ? key || t.noShop : key || t.other;
    head.innerHTML = `<span class="emoji">${esc(emoji)}</span><span>${esc(title)}</span>` +
      `<span class="count">${items.filter((i) => i.done).length}/${items.length}</span>`;
    section.appendChild(head);
    if (byShop) {
      // Phase 9l: what it will cost at that store, with its taxes.
      const st = sum(items, rateOf);
      if (st.priced) section.appendChild(el('div', 'shop-sum', sumText(st)));
    }
    for (const item of shown) section.appendChild(itemRow(item, byShop));
    main.appendChild(section);
  }

  const tot = sum(list.items, rateOf);
  const cart = tot.cartSubtotal ? `<span class="sum cart">${esc(t.cart)} <b>${esc(money(tot.cartTotal, cur()))}</b></span>` : '';
  $('totals').innerHTML = `<span>${esc(t.items(tot.count))}</span><span>${esc(t.inCart(tot.done))}</span>` +
    (tot.priced ? `<span class="sum">${tot.tax ? `${esc(t.subtotal)} ${esc(money(tot.subtotal, cur()))} + ${esc(t.taxShort)} ${esc(money(tot.tax, cur()))} = ` : ''}` +
      `${esc(t.total)} ≈ <b>${esc(money(tot.total, cur()))}</b></span>${cart}` : '');
  renderBanner();
}

/** Phase 9l: "Subtotal $20 + tax $1.65 = $21.65" (or only the total, if there is no tax). */
function sumText(st: Sum): string {
  return st.tax
    ? `${t.subtotal} ${money(st.subtotal, cur())} + ${t.taxShort} ${money(st.tax, cur())} = ${money(st.total, cur())}`
    : `${t.total} ${money(st.total, cur())}`;
}

function itemRow(item: ListItem, byShop = false): HTMLElement {
  const row = el('div', 'item' + (item.done ? ' done' : ''));
  row.dataset.id = item.id;
  const check = el('button', 'check') as HTMLButtonElement;
  check.type = 'button';
  check.setAttribute('aria-pressed', String(item.done));
  check.setAttribute('aria-label', item.name);
  check.onclick = (e) => {
    e.stopPropagation();
    if (!editable) { toast(t.viewMode); return; }
    item.done = !item.done;
    // Phase 9l: bought = at the purchase price (the chosen one, or the best) and at that store.
    if (item.done) {
      const offer = usedOffer(item);
      if (offer && !item.chosen) item.chosen = offer.id;
      if (offer?.store && !item.shop) { item.shop = offer.store; rememberShop(list, offer.store, shopEmoji(offer.store)); }
    }
    commit();
  };
  const body = el('div', 'item-body');
  body.appendChild(el('span', 'item-name', (byShop && item.group ? groupEmoji(item.group) + ' ' : '') + item.name));
  const meta: string[] = [];
  const q = qtyText(item.qty, item.unit);
  if (q) meta.push(q);
  if (!byShop && item.shop) meta.push(`${shopEmoji(item.shop)} ${item.shop}`);
  if (item.note) meta.push(item.note.split('\n')[0]);
  if (meta.length) body.appendChild(el('span', 'item-meta', meta.join(' · ')));
  row.append(check, body);
  if (item.note) {
    const n = el('span', 'icon', '📝');
    n.title = t.notes;
    row.appendChild(n);
  }
  if (item.photos.length) {
    const clip = el('button', 'icon clip', `📎${item.photos.length > 1 ? item.photos.length : ''}`) as HTMLButtonElement;
    clip.type = 'button';
    clip.title = t.hasPhotos;
    clip.onclick = (e) => { e.stopPropagation(); openViewer(item, 0); };
    row.appendChild(clip);
  }
  const cost = itemCost(item);
  if (cost != null) row.appendChild(el('span', 'item-price', money(cost, cur())));
  row.onclick = () => openEditor(item);
  return row;
}

// --- banner: what this list has and the catalog does not -------------------------------------------------------------------
let bannerDismissed = false;

function renderBanner(): void {
  const banner = $('banner');
  banner.innerHTML = '';
  banner.hidden = true;
  if (bannerDismissed || list.items.length === 0 || !hasAppData) return;
  const owner = list.catalogName && !store.catalogs.some((c) => c.id === list.catalogId || norm(c.name) === norm(list.catalogName));
  // Something is missing from every catalog: say so. If the list uses a catalog the user lacks, create it with all its items.
  const lacking = missingInCatalog(list, store.catalogs);
  const count = lacking.reduce((n, g) => n + g.products.length, 0);
  if (count === 0) return;
  const missing = owner ? missingInCatalog(list, []) : lacking;
  banner.appendChild(el('span', '', owner ? t.missingCatalog(list.catalogName) : t.missing(count, catalog?.name ?? '')));
  const go = el('button', 'btn primary', owner ? t.createCatalog : t.addMissing) as HTMLButtonElement;
  go.onclick = () => {
    let created: Catalog | null = null;
    if (owner || !catalog) {
      created = emptyCatalog(list.catalogName || t.catalog, '🛍️');
      store.catalogs.push(created);
    }
    for (const g of missing) {
      // Each group goes to the catalog that already has it (current one first); if none, to the new or the current one.
      const target = created ?? (findGroup(catalog, g.name) ? catalog : store.catalogs.find((c) => findGroup(c, g.name))) ?? catalog!;
      for (const p of g.products) addToCatalog(target, g.name, g.emoji, p.name, p.unit, p.taxable);
    }
    if (created) {
      catalog = created;
      store.lastCatalog = created.id;
      if (editable) { list.catalogId = created.id; list.catalogName = created.name; scheduleSave(); }
    }
    saveStore();
    renderAll();
  };
  const later = el('button', 'btn', t.dismiss) as HTMLButtonElement;
  later.onclick = () => { bannerDismissed = true; renderBanner(); };
  banner.append(go, later);
  banner.hidden = false;
}

// --- add by typing --------------------------------------------------------------------------------------------------------
const addInput = $<HTMLInputElement>('addInput');
const suggest = $('suggest');
let suggestIndex = -1;
let suggestions: { label: string; emoji: string; run: () => void }[] = [];

function updateSuggestions(): void {
  const text = addInput.value.trim();
  suggest.innerHTML = '';
  suggestions = [];
  suggestIndex = -1;
  if (!text) { suggest.hidden = true; return; }
  const quick = parseQuick(text);
  for (const { group, product } of searchProducts(catalog, quick.name)) {
    suggestions.push({ label: product.name, emoji: group.emoji, run: () => addItem(product.name, group.name, group.emoji, quick.qty, quick.unit || product.unit) });
  }
  if (!findProduct(catalog, quick.name)) {
    suggestions.push({ label: t.addTo(quick.name), emoji: '＋', run: () => addItem(quick.name, '', '', quick.qty, quick.unit) });
  }
  suggestions.forEach((s, i) => {
    const row = el('div', 'suggest-item');
    row.innerHTML = `<span class="emoji">${esc(s.emoji)}</span><span>${esc(s.label)}</span>`;
    row.onpointerdown = (e) => { e.preventDefault(); pickSuggestion(i); };
    suggest.appendChild(row);
  });
  suggest.hidden = suggestions.length === 0;
}

function pickSuggestion(i: number): void {
  const s = suggestions[i];
  if (!s) return;
  s.run();
  addInput.value = '';
  updateSuggestions();
}

addInput.placeholder = t.add;
addInput.addEventListener('input', updateSuggestions);
addInput.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; }, 150));
addInput.addEventListener('focus', updateSuggestions);
addInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!suggestions.length) return;
    suggestIndex = (suggestIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length;
    suggest.querySelectorAll('.suggest-item').forEach((x, i) => x.classList.toggle('on', i === suggestIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const text = addInput.value.trim();
    if (!text) return;
    if (suggestIndex >= 0) { pickSuggestion(suggestIndex); return; }
    const quick = parseQuick(text);
    const found = findProduct(catalog, quick.name);
    if (found) addItem(found.product.name, found.group.name, found.group.emoji, quick.qty, quick.unit || found.product.unit);
    else addItem(quick.name, '', '', quick.qty, quick.unit);
    addInput.value = '';
    updateSuggestions();
  } else if (e.key === 'Escape') {
    addInput.value = '';
    updateSuggestions();
  }
});
$('addBtn').onclick = () => addInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

// --- Phase 9l: the store at the top (new items go to that store; it picks its catalog) --------------------------------------
const shopPicker: Picker = createPicker($('shopPick'), t.shop);
const shopLabel = (x: Shop) => `${x.emoji} ${x.name}`;

function renderShopPicker(): void {
  const current = currentShop();
  shopPicker.set([t.noShop, ...store.shops.map(shopLabel), t.newShop], current ? shopLabel(current) : t.noShop);
  addInput.placeholder = current ? t.addTo(current.name).replace(/[«»"]/g, '') + '...' : t.add;
}

shopPicker.onchange = async (label) => {
  if (label === t.newShop) {
    const created = await editShop(null);
    if (created) store.lastShop = created.id;
  } else {
    store.lastShop = store.shops.find((x) => shopLabel(x) === label)?.id ?? null;
  }
  selectShopCatalog();
  saveStore();
  renderAll();
};

/** With a store picked, switch the catalog to one of its own. */
function selectShopCatalog(): void {
  const shop = currentShop();
  if (!shop || !shop.catalogIds.length || (catalog && shop.catalogIds.includes(catalog.id))) return;
  const first = store.catalogs.find((c) => shop.catalogIds.includes(c.id));
  if (first) { catalog = first; store.lastCatalog = first.id; }
}

// --- Phase 9l: stores and settings (app data: can be changed in view mode too) ---------------------------------------------
async function editShop(shop: Shop | null): Promise<Shop | null> {
  const catalogLabels = store.catalogs.map((c) => `${c.emoji} ${c.name}`);
  const r = await dialog(shop ? t.editShop : t.newShop.replace('...', ''), [
    { label: t.groupEmoji, value: shop?.emoji ?? '🏪' },
    { label: t.shopName, value: shop?.name ?? '' },
    { label: t.shopCatalogs, kind: 'multi', choices: catalogLabels,
      values: store.catalogs.filter((c) => shop?.catalogIds.includes(c.id) ?? c.id === catalog?.id).map((c) => `${c.emoji} ${c.name}`) },
    { label: t.shopTax(store.settings.taxRate), value: shop?.tax == null ? '' : String(shop.tax), placeholder: String(store.settings.taxRate), inputMode: 'decimal' },
  ]);
  if (!r || !r[1]) return null;
  const chosen = r[2].split('\n');
  const target = shop ?? { id: newId(), name: '', emoji: '🏪', catalogIds: [], tax: null };
  const oldName = target.name;
  target.emoji = r[0] || '🏪';
  target.name = r[1];
  target.catalogIds = store.catalogs.filter((c) => chosen.includes(`${c.emoji} ${c.name}`)).map((c) => c.id);
  target.tax = parseNum(r[3]);
  if (!shop) store.shops.push(target);
  // Renamed: update this list too.
  if (shop && oldName && norm(oldName) !== norm(target.name) && editable) {
    for (const it of list.items) {
      if (norm(it.shop) === norm(oldName)) it.shop = target.name;
      for (const o of it.offers) if (norm(o.store) === norm(oldName)) o.store = target.name;
    }
    list.shops = list.shops.filter((x) => norm(x.name) !== norm(oldName));
    rememberShop(list, target.name, target.emoji);
    scheduleSave();
  }
  saveStore();
  return target;
}

async function manageShops(): Promise<void> {
  const modal = $('modal');
  modal.innerHTML = '';
  const box = el('div', 'modal-box');
  box.appendChild(el('h3', '', t.shops));
  const rows = el('div', 'shop-rows');
  const draw = () => {
    rows.innerHTML = '';
    if (!store.shops.length) rows.appendChild(el('div', 'muted', t.noShops));
    for (const shop of store.shops) {
      const row = el('div', 'shop-row');
      const cats = store.catalogs.filter((c) => shop.catalogIds.includes(c.id)).map((c) => c.emoji + ' ' + c.name).join(', ');
      const info = el('div', 'shop-info');
      info.appendChild(el('b', '', `${shop.emoji} ${shop.name}`));
      info.appendChild(el('span', 'muted', [cats, shop.tax != null ? `${t.taxShort} ${shop.tax}%` : ''].filter(Boolean).join(' · ')));
      const edit = el('button', 'mini', '✎') as HTMLButtonElement;
      edit.onclick = async () => { modal.hidden = true; await editShop(shop); renderAll(); manageShops(); };
      const del = el('button', 'mini danger', '🗑') as HTMLButtonElement;
      del.onclick = async () => {
        modal.hidden = true;
        if (await confirmBox(t.confirmDeleteShop(shop.name), t.delete, true)) {
          store.shops = store.shops.filter((x) => x !== shop);
          if (store.lastShop === shop.id) store.lastShop = null;
          saveStore();
          renderAll();
        }
        manageShops();
      };
      row.append(info, edit, del);
      rows.appendChild(row);
    }
  };
  draw();
  box.appendChild(rows);
  const buttons = el('div', 'modal-buttons');
  const add = el('button', 'btn', t.newShop) as HTMLButtonElement;
  add.onclick = async () => { modal.hidden = true; await editShop(null); renderAll(); manageShops(); };
  const close = el('button', 'btn primary', t.close) as HTMLButtonElement;
  close.onclick = () => { modal.hidden = true; modal.innerHTML = ''; modalClose = null; };
  buttons.append(add, close);
  box.appendChild(buttons);
  modal.appendChild(box);
  modal.hidden = false;
  modalClose = () => close.click();
}

async function editSettings(): Promise<void> {
  const r = await dialog(t.settings.replace('...', ''), [
    { label: t.taxRate, value: String(store.settings.taxRate), inputMode: 'decimal' },
    { label: t.currencyPrompt, value: store.settings.currency },
  ]);
  if (!r) return;
  store.settings.taxRate = parseNum(r[0]) ?? 0;
  store.settings.currency = r[1].slice(0, 4) || '$';
  saveStore();
  renderAll();
}

// --- the catalog panel -----------------------------------------------------------------------------------------------------
const panel = $('panel');
let panelEditing = false;
const openGroups = new Set<string>();
const catalogPicker: Picker = createPicker($('catalogPick'), t.catalogs);
const catalogLabel = (c: Catalog) => `${c.emoji} ${c.name}`;

catalogPicker.onchange = (label) => {
  const chosen = store.catalogs.find((c) => catalogLabel(c) === label);
  if (!chosen) return;
  catalog = chosen;
  store.lastCatalog = chosen.id;
  saveStore();
  if (editable) { list.catalogId = chosen.id; list.catalogName = chosen.name; scheduleSave(); }
  renderAll();
};

function openPanel(open = panel.hidden): void {
  panel.hidden = !open;
  document.body.classList.toggle('panel-open', open);
  $('catalogBtn').classList.toggle('on', open);
  if (open) renderPanel();
}

function renderPanel(): void {
  if (panel.hidden) return;
  catalogPicker.set(store.catalogs.map(catalogLabel), catalog ? catalogLabel(catalog) : null);
  $('editCatalog').textContent = panelEditing ? t.doneEditing : t.editCatalog;
  panel.classList.toggle('editing', panelEditing);
  const body = $('panelBody');
  body.innerHTML = '';
  if (!catalog) { body.appendChild(el('div', 'empty', t.noCatalog)); return; }
  const inList = new Set(list.items.filter((i) => !i.done).map((i) => norm(i.name)));
  const query = $<HTMLInputElement>('catalogSearch').value.trim();

  const chip = (group: CatalogGroup, product: { id: string; name: string; unit: string }) => {
    const b = el('button', 'chip' + (inList.has(norm(product.name)) ? ' in' : '')) as HTMLButtonElement;
    b.type = 'button';
    b.textContent = product.name;
    if (inList.has(norm(product.name))) b.title = t.inList;
    b.onclick = async () => {
      if (!panelEditing) { addItem(product.name, group.name, group.emoji, null, product.unit); return; }
      const p = group.products.find((x) => x.id === product.id);
      if (!p) return;
      const taxChoices = [t.taxLikeGroup(group.taxable ? t.yes : t.no), t.yes, t.no];
      const r = await dialog(t.productName, [{ label: t.productName, value: p.name }, { label: t.unit, value: p.unit, placeholder: 'kg, L, u...' },
        { label: t.taxable, kind: 'choice', choices: taxChoices, value: p.taxable == null ? taxChoices[0] : p.taxable ? t.yes : t.no }], t.ok);
      if (!r || !r[0]) return;
      p.name = r[0];
      p.unit = r[1];
      p.taxable = r[2] === taxChoices[0] ? null : r[2] === t.yes;
      saveStore();
      renderAll();
    };
    if (panelEditing) {
      const x = el('span', 'chip-x', '×');
      x.onclick = (e) => {
        e.stopPropagation();
        group.products = group.products.filter((p) => p.id !== product.id);
        saveStore();
        renderPanel();
      };
      b.appendChild(x);
    }
    return b;
  };

  if (query) {
    const wrap = el('div', 'chips');
    for (const { group, product } of searchProducts(catalog, query, 60)) wrap.appendChild(chip(group, product));
    if (!wrap.children.length) wrap.appendChild(el('div', 'empty small', '—'));
    body.appendChild(wrap);
    return;
  }

  const freq = frequent(catalog);
  if (freq.length && !panelEditing) {
    body.appendChild(el('h3', 'panel-sub', '⭐ ' + t.frequent));
    const wrap = el('div', 'chips');
    for (const { group, product } of freq) wrap.appendChild(chip(group, product));
    body.appendChild(wrap);
  }

  for (const group of catalog.groups) {
    const section = el('section', 'cat-group' + (openGroups.has(group.id) || panelEditing ? ' open' : ''));
    const head = el('button', 'cat-head') as HTMLButtonElement;
    head.type = 'button';
    const count = group.products.filter((p) => inList.has(norm(p.name))).length;
    head.innerHTML = `<span class="emoji">${esc(group.emoji)}</span><span class="cat-name">${esc(group.name)}</span>` +
      (count ? `<span class="badge">${count}</span>` : '') + `<span class="caret">▸</span>`;
    head.onclick = () => {
      if (panelEditing) return;
      if (openGroups.has(group.id)) openGroups.delete(group.id); else openGroups.add(group.id);
      section.classList.toggle('open');
    };
    section.appendChild(head);
    if (panelEditing) {
      const tools = el('div', 'cat-tools');
      const rename = el('button', 'mini', '✎') as HTMLButtonElement;
      rename.onclick = async () => {
        const r = await dialog(t.groupName, [{ label: t.groupEmoji, value: group.emoji }, { label: t.groupName, value: group.name }]);
        if (!r || !r[1]) return;
        group.emoji = r[0] || '•';
        group.name = r[1];
        saveStore();
        renderAll();
      };
      const up = el('button', 'mini', '↑') as HTMLButtonElement;
      up.onclick = () => {
        const i = catalog!.groups.indexOf(group);
        if (i > 0) { [catalog!.groups[i - 1], catalog!.groups[i]] = [catalog!.groups[i], catalog!.groups[i - 1]]; saveStore(); renderAll(); }
      };
      const del = el('button', 'mini danger', '🗑') as HTMLButtonElement;
      del.onclick = async () => {
        if (!(await confirmBox(t.confirmDeleteGroup(group.name), t.delete, true))) return;
        catalog!.groups = catalog!.groups.filter((x) => x !== group);
        saveStore();
        renderAll();
      };
      // Phase 9l: whether the group's items are taxed.
      const tax = el('button', 'mini tax' + (group.taxable ? ' on' : ''), group.taxable ? t.taxShort : t.noTaxShort) as HTMLButtonElement;
      tax.title = t.taxable;
      tax.onclick = () => { group.taxable = !group.taxable; saveStore(); renderPanel(); };
      tools.append(tax, rename, up, del);
      head.appendChild(tools);
    }
    const wrap = el('div', 'chips');
    for (const product of group.products) wrap.appendChild(chip(group, product));
    if (panelEditing) {
      const add = el('button', 'chip add', t.addProduct) as HTMLButtonElement;
      add.onclick = async () => {
        const r = await dialog(group.name, [{ label: t.productName, value: '' }, { label: t.unit, value: '', placeholder: 'kg, L, u...' }]);
        if (!r || !r[0]) return;
        addToCatalog(catalog!, group.name, group.emoji, r[0], r[1]);
        saveStore();
        renderAll();
      };
      wrap.appendChild(add);
    }
    section.appendChild(wrap);
    body.appendChild(section);
  }

  if (panelEditing) {
    const add = el('button', 'btn wide', t.addGroup) as HTMLButtonElement;
    add.onclick = async () => {
      const r = await dialog(t.addGroup.replace('+', '').trim(), [{ label: t.groupEmoji, value: '🛍️' }, { label: t.groupName, value: '' },
        { label: t.taxable, kind: 'choice', choices: [t.yes, t.no], value: t.yes }]);
      if (!r || !r[1]) return;
      addToCatalog(catalog!, r[1], r[0] || '•', undefined, '', r[2] === t.yes);
      saveStore();
      renderAll();
    };
    body.appendChild(add);
  }
}

$<HTMLInputElement>('catalogSearch').placeholder = t.search;
$<HTMLInputElement>('catalogSearch').addEventListener('input', renderPanel);
$('editCatalog').onclick = () => { panelEditing = !panelEditing; renderPanel(); };
$('closePanel').onclick = () => openPanel(false);
$('closePanel').setAttribute('aria-label', t.close);
$('catalogBtn').onclick = () => openPanel();

// catalog menu
const catalogMenu = $('catalogMenu');
$('catalogMenuBtn').onclick = (e) => { e.stopPropagation(); toggleMenu(catalogMenu); };

function buildCatalogMenu(): void {
  catalogMenu.innerHTML = '';
  const entry = (label: string, run: () => void, danger = false) => {
    const b = el('button', 'menu-item' + (danger ? ' danger' : ''), label) as HTMLButtonElement;
    b.onclick = () => { closeMenus(); run(); };
    catalogMenu.appendChild(b);
  };
  entry(t.newCatalog, async () => {
    const templates = (Object.keys(SEEDS) as SeedId[]).map((id) => seedName(id, lang));
    const r = await dialog(t.newCatalog.replace('...', ''), [
      { label: t.catalogName, value: '' },
      { label: t.template, kind: 'choice', choices: [t.templateEmpty, ...templates], value: t.templateEmpty },
    ], t.create);
    if (!r) return;
    const seedIndex = templates.indexOf(r[1]);
    const created = seedIndex >= 0 ? catalogFromSeed((Object.keys(SEEDS) as SeedId[])[seedIndex], lang) : emptyCatalog(r[0] || t.catalog);
    if (r[0]) created.name = r[0];
    store.catalogs.push(created);
    catalog = created;
    store.lastCatalog = created.id;
    if (editable) { list.catalogId = created.id; list.catalogName = created.name; scheduleSave(); }
    saveStore();
    renderAll();
  });
  entry(t.renameCatalog, async () => {
    if (!catalog) return;
    const r = await dialog(t.renameCatalog.replace('...', ''), [{ label: t.groupEmoji, value: catalog.emoji }, { label: t.catalogName, value: catalog.name }]);
    if (!r || !r[1]) return;
    catalog.emoji = r[0] || '🛍️';
    catalog.name = r[1];
    if (editable && list.catalogId === catalog.id) { list.catalogName = catalog.name; scheduleSave(); }
    saveStore();
    renderAll();
  });
  entry(t.deleteCatalog, async () => {
    if (!catalog || !(await confirmBox(t.confirmDeleteCatalog(catalog.name), t.delete, true))) return;
    store.catalogs = store.catalogs.filter((c) => c !== catalog);
    catalog = store.catalogs[0] ?? null;
    store.lastCatalog = catalog?.id ?? null;
    saveStore();
    renderAll();
  }, true);
}

// --- list menu ------------------------------------------------------------------------------------------------------------
const listMenu = $('menu');
$('menuBtn').onclick = (e) => { e.stopPropagation(); buildListMenu(); toggleMenu(listMenu); };
$('menuBtn').setAttribute('aria-label', t.more);

function buildListMenu(): void {
  listMenu.innerHTML = '';
  const entry = (label: string, run: () => void, danger = false) => {
    const b = el('button', 'menu-item' + (danger ? ' danger' : ''), label) as HTMLButtonElement;
    b.onclick = () => { closeMenus(); run(); };
    listMenu.appendChild(b);
  };
  // Phase 9l: stores and settings are app data: available in view mode too.
  entry(t.shops + '...', () => manageShops());
  entry(t.settings, () => editSettings());
  if (!editable) { listMenu.appendChild(el('div', 'menu-note', t.viewMode)); return; }
  entry(list.view === 'shop' ? t.viewByGroup : t.viewByShop, () => { list.view = list.view === 'shop' ? 'group' : 'shop'; commit(); });
  entry(list.hideDone ? t.showDone : t.hideDone, () => { list.hideDone = !list.hideDone; commit(); });
  entry(t.uncheckAll, () => { list.items.forEach((i) => { i.done = false; }); commit(); });
  entry(t.removeDone, async () => {
    const done = list.items.filter((i) => i.done);
    if (!done.length || !(await confirmBox(t.confirmRemoveDone(done.length), t.delete, true))) return;
    await removeItems(done);
  }, true);
  entry(t.currency, async () => {
    const r = await askText(t.currency.replace('...', ''), t.currencyPrompt, cur());
    if (r != null) { list.currency = r.slice(0, 4); commit(); }
  });
  entry(t.clearList, async () => {
    if (!list.items.length || !(await confirmBox(t.confirmClear, t.delete, true))) return;
    await removeItems([...list.items]);
  }, true);
}

async function removeItems(items: ListItem[]): Promise<void> {
  const ids = new Set(items.map((i) => i.id));
  list.items = list.items.filter((i) => !ids.has(i.id));
  commit();
  // Those items' photos (attachments) go too.
  for (const name of items.flatMap((i) => i.photos)) {
    try { await docodez.deleteAttachment?.(name); } catch { /* already gone */ }
  }
}

let openMenu: HTMLElement | null = null;
function toggleMenu(menu: HTMLElement): void {
  const wasOpen = !menu.hidden;
  closeMenus();
  if (!wasOpen) { menu.hidden = false; openMenu = menu; }
}
function closeMenus(): void {
  if (openMenu) openMenu.hidden = true;
  openMenu = null;
}
document.addEventListener('pointerdown', (e) => {
  if (openMenu && !openMenu.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.menu-btn')) closeMenus();
});

// --- edit an item ---------------------------------------------------------------------------------------------------------
let editorItem: ListItem | null = null;

function openEditor(item: ListItem): void {
  editorItem = item;
  renderEditor();
  $('sheet').hidden = false;
}

function closeEditor(): void {
  $('sheet').hidden = true;
  editorItem = null;
  renderList();
  renderPanel();
}

function renderEditor(): void {
  const item = editorItem;
  if (!item) return;
  const sheet = $('sheetBox');
  sheet.innerHTML = '';
  const ro = !editable;
  const head = el('div', 'sheet-head');
  head.appendChild(el('h3', '', `${groupEmoji(item.group)} ${t.editItem}`));
  const x = el('button', 'icon-btn', '✕') as HTMLButtonElement;
  x.setAttribute('aria-label', t.close);
  x.onclick = closeEditor;
  head.appendChild(x);
  sheet.appendChild(head);
  if (ro) sheet.appendChild(el('div', 'note-ro', t.viewMode));

  // A <div>, not a <label>: the browser forwards a click inside a <label> to its first button (tapping a price's store
  // marked it as the purchase price).
  const field = (label: string, control: HTMLElement) => {
    const wrap = el('div', 'field');
    wrap.appendChild(el('span', '', label));
    wrap.appendChild(control);
    sheet.appendChild(wrap);
    return wrap;
  };
  const input = (value: string, onInput: (v: string) => void, attrs: Partial<HTMLInputElement> = {}) => {
    const i = el('input') as HTMLInputElement;
    i.value = value;
    i.disabled = ro;
    i.autocomplete = 'off';
    Object.assign(i, attrs);
    i.addEventListener('input', () => { onInput(i.value); scheduleSave(); });
    return i;
  };

  field(t.name, input(item.name, (v) => { item.name = v; }));

  // group: the catalog's and the list's
  const groupHost = el('div');
  const groups = new Map<string, string>(); // label -> name
  groups.set(t.noGroup, '');
  for (const gr of catalog?.groups ?? []) groups.set(`${gr.emoji} ${gr.name}`, gr.name);
  for (const gr of list.groups) if (![...groups.values()].some((n) => norm(n) === norm(gr.name))) groups.set(`${gr.emoji} ${gr.name}`, gr.name);
  const groupPicker = createPicker(groupHost, t.group);
  const currentLabel = [...groups].find(([, n]) => norm(n) === norm(item.group))?.[0] ?? (item.group ? `${item.emoji} ${item.group}` : t.noGroup);
  if (!groups.has(currentLabel)) groups.set(currentLabel, item.group);
  groupPicker.set([...groups.keys()], currentLabel);
  groupPicker.onchange = (label) => {
    if (ro) { groupPicker.set([...groups.keys()], currentLabel); return; }
    item.group = groups.get(label) ?? '';
    item.emoji = item.group ? groupEmoji(item.group) : '';
    rememberGroup(list, item.group, item.emoji);
    scheduleSave();
    renderEditor();
  };
  field(t.group, groupHost);

  // quantity and unit
  const qtyRow = el('div', 'row');
  qtyRow.appendChild(input(item.qty == null ? '' : String(item.qty), (v) => { item.qty = parseNum(v); updateCost(); }, { inputMode: 'decimal', className: 'qty' }));
  const unitHost = el('div');
  const unitPicker = createPicker(unitHost, t.unit);
  unitPicker.set(UNITS.map((u) => u || '—'), item.unit || '—');
  unitPicker.onchange = (u) => { if (ro) return; item.unit = u === '—' ? '' : u; scheduleSave(); renderEditor(); };
  qtyRow.appendChild(unitHost);
  field(t.quantity, qtyRow);

  // Phase 9l: the store where it is (or was) bought, and whether it is taxed
  const shopRow = el('div', 'row');
  const shopHost = el('div');
  const shopPick = createPicker(shopHost, t.shop);
  const shopNames = shopChoices(item.shop);
  shopPick.set([t.noShop, ...shopNames.map((n) => `${shopEmoji(n)} ${n}`), ...(ro ? [] : [t.newShop])], item.shop ? `${shopEmoji(item.shop)} ${item.shop}` : t.noShop);
  shopPick.onchange = async (label) => {
    if (ro) return renderEditor();
    if (label === t.newShop) {
      const created = await editShop(null);
      if (created) item.shop = created.name;
    } else {
      item.shop = shopNames.find((n) => `${shopEmoji(n)} ${n}` === label) ?? '';
    }
    if (item.shop) rememberShop(list, item.shop, shopEmoji(item.shop));
    scheduleSave();
    renderEditor();
  };
  shopRow.appendChild(shopHost);
  const tax = el('label', 'toggle');
  const taxBox = el('input') as HTMLInputElement;
  taxBox.type = 'checkbox';
  taxBox.checked = item.taxable;
  taxBox.disabled = ro;
  taxBox.onchange = () => { item.taxable = taxBox.checked; scheduleSave(); updateCost(); };
  tax.append(taxBox, el('span', '', t.taxable));
  shopRow.appendChild(tax);
  field(t.shop, shopRow);

  const note = el('textarea') as HTMLTextAreaElement;
  note.value = item.note;
  note.placeholder = t.notePlaceholder;
  note.disabled = ro;
  note.rows = 2;
  note.addEventListener('input', () => { item.note = note.value; scheduleSave(); });
  field(t.note, note);

  // photos
  const photos = el('div', 'photos');
  item.photos.forEach((name, i) => {
    const thumb = el('button', 'thumb') as HTMLButtonElement;
    thumb.type = 'button';
    const img = el('img') as HTMLImageElement;
    img.alt = name;
    void photoUrl(name).then((u) => { img.src = u; });
    thumb.appendChild(img);
    thumb.onclick = () => openViewer(item, i);
    photos.appendChild(thumb);
  });
  if (!ro) {
    // Phase 11f: with a camera (Android), take the photo or pick it from files.
    const sources: [string, boolean][] = hasCamera() ? [[t.addPhotoCamera, true], [t.addPhotoFile, false]] : [[t.addPhoto, false]];
    for (const [label, camera] of sources) {
      const add = el('button', 'thumb add', label) as HTMLButtonElement;
      add.type = 'button';
      add.onclick = () => addPhoto(item, camera);
      photos.appendChild(add);
    }
  }
  field(t.photos, photos);

  // prices
  const prices = el('div', 'prices');
  const per = compareUnit(item);
  const best = bestOffer(item);
  const used = usedOffer(item);
  for (const offer of item.offers) prices.appendChild(offerRow(item, offer, per, offer === best && item.offers.length > 1, offer === used));
  if (!ro) {
    const add = el('button', 'btn small', t.addPrice) as HTMLButtonElement;
    add.type = 'button';
    add.onclick = () => {
      const last = item.offers[item.offers.length - 1];
      // Phase 9l: a new price, for the current store (the one at the top) or the item's store.
      item.offers.push({ id: newId(), store: currentShop()?.name ?? item.shop ?? last?.store ?? '', price: null, amount: null, unit: last?.unit ?? item.unit });
      scheduleSave();
      renderEditor();
      sheet.querySelector<HTMLInputElement>('.offer:last-of-type .o-price')?.focus();
    };
    prices.appendChild(add);
  }
  const cost = el('div', 'cost');
  cost.id = 'editorCost';
  prices.appendChild(cost);
  field(t.prices, prices);
  updateCost();

  // footer
  const foot = el('div', 'sheet-foot');
  if (item.group && hasAppData) {
    const known = findGroup(catalog, item.group)?.products.some((p) => norm(p.name) === norm(item.name));
    const addCat = el('button', 'btn', known ? '✓ ' + t.inCatalog : t.addToCatalog) as HTMLButtonElement;
    addCat.disabled = !!known || !catalog;
    addCat.onclick = () => {
      if (!catalog) return;
      addToCatalog(catalog, item.group, item.emoji || groupEmoji(item.group), item.name, item.unit);
      saveStore();
      renderEditor();
      renderBanner();
    };
    foot.appendChild(addCat);
  }
  if (!ro) {
    const remove = el('button', 'btn danger', t.removeItem) as HTMLButtonElement;
    remove.onclick = async () => {
      closeEditor();
      await removeItems([item]);
    };
    foot.appendChild(remove);
  }
  const close = el('button', 'btn primary', t.close) as HTMLButtonElement;
  close.onclick = closeEditor;
  foot.appendChild(close);
  sheet.appendChild(foot);
}

function offerRow(item: ListItem, offer: Offer, per: string, isBest: boolean, isUsed: boolean): HTMLElement {
  const ro = !editable;
  const row = el('div', 'offer' + (isUsed ? ' used' : ''));
  const num = (v: number | null, cls: string, ph: string, set: (n: number | null) => void) => {
    const i = el('input', cls) as HTMLInputElement;
    i.value = v == null ? '' : String(v);
    i.placeholder = ph;
    i.inputMode = 'decimal';
    i.disabled = ro;
    i.addEventListener('input', () => { set(parseNum(i.value)); scheduleSave(); updateCost(); });
    return i;
  };
  // Phase 9l: each price's store, from the store list (or a new one).
  const storeHost = el('div', 'o-store');
  const storePick = createPicker(storeHost, t.store);
  const names = shopChoices(offer.store);
  storePick.set(['—', ...names.map((n) => `${shopEmoji(n)} ${n}`), ...(ro ? [] : [t.newShop])], offer.store ? `${shopEmoji(offer.store)} ${offer.store}` : '—');
  storePick.onchange = async (label) => {
    if (ro) return;
    if (label === t.newShop) {
      const created = await editShop(null);
      if (created) offer.store = created.name;
    } else {
      offer.store = names.find((n) => `${shopEmoji(n)} ${n}` === label) ?? '';
    }
    if (offer.store) rememberShop(list, offer.store, shopEmoji(offer.store));
    if (item.chosen === offer.id && offer.store) item.shop = offer.store;
    scheduleSave();
    renderEditor();
  };
  const use = el('button', 'o-use' + (isUsed ? ' on' : ''), isUsed ? '●' : '○') as HTMLButtonElement;
  use.type = 'button';
  use.title = t.use;
  use.disabled = ro;
  // Phase 9l: the purchase price: the total uses this one, and the item moves to that store.
  use.onclick = () => { item.chosen = offer.id; if (offer.store) item.shop = offer.store; scheduleSave(); renderEditor(); };
  const unitHost = el('div', 'o-unit');
  const unit = createPicker(unitHost, t.unit);
  unit.set(UNITS.map((u) => u || '—'), offer.unit || '—');
  unit.onchange = (u) => { if (ro) return; offer.unit = u === '—' ? '' : u; scheduleSave(); renderEditor(); };
  const del = el('button', 'mini', '✕') as HTMLButtonElement;
  del.type = 'button';
  del.disabled = ro;
  del.onclick = () => {
    item.offers = item.offers.filter((o) => o !== offer);
    if (item.chosen === offer.id) item.chosen = null;
    scheduleSave();
    renderEditor();
  };
  const up = unitPrice(offer, per);
  const info = el('span', 'o-per' + (isBest ? ' best' : ''),
    up == null ? '' : `${money(up, cur())} ${t.perUnit} ${per || 'u'}${isBest ? ' · ' + t.best : ''}`);
  info.dataset.offer = offer.id;
  row.append(use, storeHost, num(offer.price, 'o-price', list.currency, (n) => { offer.price = n; }),
    num(offer.amount, 'o-amount', t.amount, (n) => { offer.amount = n; }), unitHost, del, info);
  return row;
}

/** Recomputes the unit price and the estimate without redrawing the editor (so typing keeps focus). */
function updateCost(): void {
  const item = editorItem;
  if (!item) return;
  const per = compareUnit(item);
  const best = bestOffer(item);
  for (const offer of item.offers) {
    const info = document.querySelector<HTMLElement>(`.o-per[data-offer="${offer.id}"]`);
    if (!info) continue;
    const up = unitPrice(offer, per);
    const isBest = offer === best && item.offers.length > 1;
    info.className = 'o-per' + (isBest ? ' best' : '');
    info.textContent = up == null ? '' : `${money(up, cur())} ${t.perUnit} ${per || 'u'}${isBest ? ' · ' + t.best : ''}`;
  }
  const cost = $('editorCost');
  if (cost) {
    const c = itemCost(item);
    const tx = itemTax(item, rateOf(item.shop));
    const offer = usedOffer(item);
    cost.textContent = c == null ? '' : `${t.estimated}${offer?.store ? ` (${offer.store})` : ''}: ${money(c, cur())}` +
      (tx ? ` + ${t.taxShort} ${money(tx, cur())} = ${money(c + tx, cur())}` : '');
  }
}

/** Phase 9l: the stores to pick from: the app's, the list's and the current one (even if it no longer exists). */
function shopChoices(current: string): string[] {
  const names: string[] = [];
  const add = (n: string) => { if (n && !names.some((x) => norm(x) === norm(n))) names.push(n); };
  store.shops.forEach((x) => add(x.name));
  list.shops.forEach((x) => add(x.name));
  add(current);
  return names;
}

// --- photos -----------------------------------------------------------------------------------------------------------------
const photoUrls = new Map<string, Promise<string>>();
const photoUrl = (name: string) => {
  let url = photoUrls.get(name);
  if (!url) { url = docodez.attachmentUrl(name); photoUrls.set(name, url); }
  return url;
};

/** Shrinks the photo (long side 1600 px, JPEG): a phone photo weighs several MB and goes inside the document. */
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
    return data; // a format the browser cannot open: keep as is
  }
}

/** Phase 11f: Docodez with a camera (API 3, Android). */
const hasCamera = () => !!ctx.camera && typeof docodez.capturePhoto === 'function';

async function addPhoto(item: ListItem, camera = false): Promise<void> {
  try {
    const file = camera ? await docodez.capturePhoto!() : await docodez.pickFile(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic']);
    if (!file) return;
    const data = await shrink(file.data);
    const ext = data instanceof Blob ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase();
    const name = `compras-${item.id}-${newId()}.${ext}`;
    await docodez.putAttachment(name, data);
    item.photos.push(name);
    await saveNow();
    renderEditor();
  } catch (e) {
    toast(t.photoError + (e as Error).message);
  }
}

let viewer: { item: ListItem; index: number } | null = null;

function openViewer(item: ListItem, index: number): void {
  if (!item.photos.length) return;
  viewer = { item, index };
  $('viewer').hidden = false;
  showPhoto();
}

function showPhoto(): void {
  if (!viewer) return;
  const { item, index } = viewer;
  const name = item.photos[index];
  const img = $<HTMLImageElement>('viewerImg');
  img.removeAttribute('src');
  void photoUrl(name).then((u) => { if (viewer?.item.photos[viewer.index] === name) img.src = u; });
  $('viewerInfo').textContent = `${item.name} · ${t.photoOf(index + 1, item.photos.length)}`;
  $('viewerPrev').hidden = $('viewerNext').hidden = item.photos.length < 2;
  $('viewerDelete').hidden = !editable;
}

function moveViewer(step: number): void {
  if (!viewer) return;
  const n = viewer.item.photos.length;
  viewer.index = (viewer.index + step + n) % n;
  showPhoto();
}

function closeViewer(): void {
  $('viewer').hidden = true;
  viewer = null;
}

$('viewerPrev').onclick = () => moveViewer(-1);
$('viewerNext').onclick = () => moveViewer(1);
$('viewerClose').onclick = closeViewer;
$('viewerClose').setAttribute('aria-label', t.close);
$('viewerDelete').title = t.removePhoto;
$('viewerDelete').onclick = async () => {
  if (!viewer || !(await confirmBox(t.confirmRemovePhoto, t.delete, true))) return;
  const { item, index } = viewer;
  const [name] = item.photos.splice(index, 1);
  photoUrls.delete(name);
  scheduleSave();
  try { await docodez.deleteAttachment?.(name); } catch { /* already gone */ }
  if (item.photos.length === 0) closeViewer(); else { viewer.index = Math.min(index, item.photos.length - 1); showPhoto(); }
  renderList();
  if (editorItem === item) renderEditor();
};
// swipe to change photo
let swipeX: number | null = null;
$('viewer').addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
$('viewer').addEventListener('pointerup', (e) => {
  if (swipeX != null && Math.abs(e.clientX - swipeX) > 60) moveViewer(e.clientX < swipeX ? 1 : -1);
  swipeX = null;
});

// --- calculator -------------------------------------------------------------------------------------------------------------
// Phase 11e: with history (the last 100 calculations, in the app data: the same in every list).
const calc = createCalculator($('calc'), {
  title: t.calculator, close: t.close, copy: '', history: t.history, historyEmpty: t.historyEmpty, historyClear: t.historyClear, back: t.back,
}, {
  list: () => store.calcHistory,
  add(expr, result) {
    if (store.calcHistory[0]?.expr === expr) return;
    store.calcHistory = [{ expr, result, at: Date.now() }, ...store.calcHistory].slice(0, CALC_HISTORY_MAX);
    saveStore();
  },
  clear() { store.calcHistory = []; saveStore(); },
});
$('calcBtn').onclick = () => calc.toggle();
$('calcBtn').title = t.calculator;

// --- fallback page (search, readers without the plugin) ------------------------------------------------------------------
function preview(): string {
  const parts = [`<h2>🛒 ${esc(ctx.nodeTitle)}</h2>`];
  for (const groupName of groupOrder(list, catalog)) {
    const items = list.items.filter((i) => norm(i.group) === norm(groupName));
    if (!items.length) continue;
    parts.push(`<h3>${esc(groupEmoji(groupName))} ${esc(groupName || t.other)}</h3><ul>`);
    for (const it of items) {
      const q = qtyText(it.qty, it.unit);
      const c = itemCost(it);
      parts.push(`<li>${it.done ? '☑' : '☐'} ${it.done ? '<s>' : ''}${esc(it.name)}${it.done ? '</s>' : ''}${q ? ' — ' + esc(q) : ''}` +
        `${it.shop ? ' · ' + esc(it.shop) : ''}` +
        `${c != null ? ' · ' + esc(money(c, cur())) : ''}${it.note ? `<br><small>${esc(it.note)}</small>` : ''}</li>`);
    }
    parts.push('</ul>');
  }
  const tot = sum(list.items, rateOf);
  if (tot.priced) parts.push(`<p><b>${esc(sumText(tot))}</b></p>`);
  return parts.join('');
}

// --- mode, theme, events ------------------------------------------------------------------------------------------------------
function setEditable(value: boolean): void {
  editable = value;
  document.body.classList.toggle('editable', value);
  $('viewNote').hidden = value;
  renderAll();
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.body.classList.toggle('dark', theme === 'dark');
}

function renderAll(): void {
  renderShopPicker();
  renderList();
  renderPanel();
  buildCatalogMenu();
  if (editorItem) {
    const still = list.items.find((i) => i.id === editorItem!.id);
    if (still) { editorItem = still; renderEditor(); } else closeEditor();
  }
}

docodez.on('modechange', (p) => setEditable(p.editable));
docodez.on('themechange', (p) => applyTheme(p.theme));
docodez.on('appdatachange', async () => {
  // Another view (another list, another tab) changed the catalogs.
  if (storeTimer) return;
  store = normalizeStore(await docodez.getAppJSON().catch(() => null), lang);
  catalog = catalogOf(store, list);
  renderAll();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (modalClose) modalClose();
  else if (!$('viewer').hidden) closeViewer();
  else if (!$('sheet').hidden) closeEditor();
  else if (openMenu) closeMenus();
  else if (!$('calc').hidden) $('calc').hidden = true;
  else if (!panel.hidden) openPanel(false);
});
$('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet')) closeEditor(); });
$('catalogBtn').title = t.catalog;
$('catalogLabel').textContent = t.catalog;
$('viewNote').textContent = t.viewMode;
$('addBtn').title = t.addButton;
$('addBtn').setAttribute('aria-label', t.addButton);
document.documentElement.lang = lang;

applyTheme(ctx.theme);
setEditable(editable);
// On wide screens the catalog starts open on the side.
if (matchMedia('(min-width: 900px)').matches) openPanel(true);

// For automated tests.
(window as unknown as Record<string, unknown>).__compras = {
  get list() { return list; }, get store() { return store; }, get catalog() { return catalog; }, manageShops, editSettings,
  addItem, removeItems, openEditor, openViewer, openPanel, saveNow, renderAll, calc,
};
