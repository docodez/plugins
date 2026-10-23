// The shopping list data (stored in the node), the catalogs (stored in the app: docodez.getAppJSON), and the price
// math. No DOM: it can be tested on its own.
import { FOOD_GROUPS, type Lang, type SeedId, seedCatalog } from './seed';

// ---------------------------------------------------------------------------------------------------------------------
// Catalogs (APP data, not document data: the same for every list)

/** Phase 9l: <taxable> null = same as its group. */
export interface CatalogProduct { id: string; name: string; unit: string; uses: number; taxable: boolean | null }
/** Phase 9l: <taxable> = its items are taxed (food is not). */
export interface CatalogGroup { id: string; name: string; emoji: string; taxable: boolean; products: CatalogProduct[] }
export interface Catalog { id: string; name: string; emoji: string; groups: CatalogGroup[] }
/** Phase 9l: a store, with the catalogs of what it sells (e.g. grocery and hardware) and its own tax if different. */
export interface Shop { id: string; name: string; emoji: string; catalogIds: string[]; tax: number | null }
/** Phase 9l: plugin settings. <taxRate> in % (8.25 = 8.25 %). */
export interface Settings { taxRate: number; currency: string }
/** Phase 11e: a calculator entry (the history, newest first). */
export interface CalcEntry { expr: string; result: string; at: number }
export const CALC_HISTORY_MAX = 100;

export interface AppStore {
  version: 2; catalogs: Catalog[]; lastCatalog: string | null; shops: Shop[]; lastShop: string | null; settings: Settings;
  /** Phase 11e: the latest calculator entries (from all lists). */
  calcHistory: CalcEntry[];
}

function normalizeHistory(raw: unknown): CalcEntry[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((e): e is CalcEntry => !!e && typeof e.expr === 'string' && typeof e.result === 'string')
    .map((e) => ({ expr: e.expr, result: e.result, at: typeof e.at === 'number' ? e.at : 0 }))
    .slice(0, CALC_HISTORY_MAX);
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const norm = (s: string) => s.trim().toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export function catalogFromSeed(seed: SeedId, lang: Lang): Catalog {
  const s = seedCatalog(seed, lang);
  return {
    id: newId(), name: s.name, emoji: s.emoji,
    groups: s.groups.map((gr) => ({ id: newId(), name: gr.name, emoji: gr.emoji, taxable: gr.taxable,
      products: gr.products.map((p) => ({ id: newId(), name: p.name, unit: p.unit, uses: 0, taxable: null })) })),
  };
}

export function emptyCatalog(name: string, emoji = '🛍️'): Catalog {
  return { id: newId(), name, emoji, groups: [] };
}

/** This plugin's app data, with the grocery catalog the first time. */
export function normalizeStore(raw: unknown, lang: Lang): AppStore {
  const store = raw as Partial<AppStore> | null;
  const settings: Settings = { taxRate: 0, currency: '$', ...(store?.settings ?? {}) };
  if (store && Array.isArray(store.catalogs)) {
    for (const c of store.catalogs) {
      c.id ||= newId(); c.groups ??= []; c.emoji ||= '🛍️';
      for (const gr of c.groups) {
        gr.id ||= newId(); gr.products ??= []; gr.emoji ||= '•';
        // Phase 9l: an older catalog knows nothing about taxes: the template food groups get none.
        if (typeof gr.taxable !== 'boolean') gr.taxable = !FOOD_GROUPS.has(gr.name.trim().toLocaleLowerCase());
        for (const p of gr.products) { p.id ||= newId(); p.unit ??= ''; p.uses ??= 0; p.taxable ??= null; }
      }
    }
    const shops = Array.isArray(store.shops) ? store.shops : [];
    for (const shop of shops) { shop.id ||= newId(); shop.emoji ||= '🏪'; shop.catalogIds ??= []; shop.tax ??= null; }
    return { version: 2, catalogs: store.catalogs, lastCatalog: store.lastCatalog ?? store.catalogs[0]?.id ?? null, shops,
      lastShop: store.lastShop ?? null, settings, calcHistory: normalizeHistory(store.calcHistory) };
  }

  const grocery = catalogFromSeed('grocery', lang);
  return { version: 2, catalogs: [grocery], lastCatalog: grocery.id, shops: [], lastShop: null, settings, calcHistory: [] };
}

export function findGroup(catalog: Catalog | null, name: string): CatalogGroup | undefined {
  const n = norm(name);
  return catalog?.groups.find((gr) => norm(gr.name) === n);
}

export function findProduct(catalog: Catalog | null, name: string): { group: CatalogGroup; product: CatalogProduct } | undefined {
  const n = norm(name);
  for (const group of catalog?.groups ?? []) {
    const product = group.products.find((p) => norm(p.name) === n);
    if (product) return { group, product };
  }
  return undefined;
}

/** Catalog items containing the text (those starting with it first, then the most used). */
export function searchProducts(catalog: Catalog | null, text: string, max = 8) {
  const n = norm(text);
  if (!n || !catalog) return [];
  const found: { group: CatalogGroup; product: CatalogProduct; rank: number }[] = [];
  for (const group of catalog.groups) {
    for (const product of group.products) {
      const pn = norm(product.name);
      const i = pn.indexOf(n);
      if (i >= 0) found.push({ group, product, rank: (i === 0 ? 0 : pn.includes(' ' + n) ? 1 : 2) * 1e6 - product.uses });
    }
  }
  return found.sort((a, b) => a.rank - b.rank).slice(0, max);
}

/** The most used catalog items. */
export function frequent(catalog: Catalog | null, max = 12) {
  const all = (catalog?.groups ?? []).flatMap((group) => group.products.filter((p) => p.uses > 0).map((product) => ({ group, product })));
  return all.sort((a, b) => b.product.uses - a.product.uses).slice(0, max);
}

/** Adds a group (if missing, with that emoji) and an item (if missing) to the catalog. Returns whether anything changed. */
export function addToCatalog(catalog: Catalog, groupName: string, emoji: string, productName?: string, unit = '', taxable: boolean | null = null): boolean {
  let changed = false;
  let group = findGroup(catalog, groupName);
  if (!group) {
    group = { id: newId(), name: groupName.trim(), emoji: emoji || '•', taxable: taxable ?? true, products: [] };
    catalog.groups.push(group);
    changed = true;
  }

  if (productName && !group.products.some((p) => norm(p.name) === norm(productName))) {
    group.products.push({ id: newId(), name: productName.trim(), unit, uses: 0, taxable: taxable === group.taxable ? null : taxable });
    changed = true;
  }

  return changed;
}

// ---------------------------------------------------------------------------------------------------------------------
// The list (NODE data). Each item carries its group's name and emoji, so the list still makes sense when opened in
// another Docodez with other catalogs (and offers to add whatever is missing).

export interface Offer { id: string; store: string; price: number | null; amount: number | null; unit: string }
/**
 * A list item. Phase 9l: <shop> = the store where it will be bought (or was bought: that of the offer chosen as
 * purchase price); <taxable> = it is taxed (copied from the catalog when added, so it travels with the list).
 */
export interface ListItem {
  id: string; name: string; group: string; emoji: string;
  qty: number | null; unit: string; note: string; photos: string[];
  done: boolean; offers: Offer[]; chosen: string | null; added: number; shop: string; taxable: boolean;
}
export interface ListGroup { name: string; emoji: string }
export interface ShoppingList {
  version: 1; catalogId: string | null; catalogName: string; groups: ListGroup[]; items: ListItem[];
  currency: string; hideDone: boolean;
  /** Phase 9l: how the list is shown: by group (as in the catalog) or by store. */
  view: 'group' | 'shop';
  /** Phase 9l: the stores the list uses (name and emoji), so they travel with it like the groups. */
  shops: ListGroup[];
}

export function normalizeList(raw: unknown): ShoppingList {
  const list = (raw ?? {}) as Partial<ShoppingList>;
  const items = Array.isArray(list.items) ? list.items : [];
  for (const it of items) {
    it.id ||= newId(); it.name ??= ''; it.group ??= ''; it.emoji ??= '';
    it.qty = typeof it.qty === 'number' && isFinite(it.qty) ? it.qty : null;
    it.unit ??= ''; it.note ??= ''; it.photos = Array.isArray(it.photos) ? it.photos : [];
    it.done = !!it.done; it.offers = Array.isArray(it.offers) ? it.offers : []; it.chosen ??= null; it.added ??= 0;
    for (const o of it.offers) { o.id ||= newId(); o.store ??= ''; o.unit ??= ''; o.price ??= null; o.amount ??= null; }
    it.shop ??= '';
    it.taxable ??= true;
  }

  return {
    version: 1, catalogId: list.catalogId ?? null, catalogName: list.catalogName ?? '', groups: Array.isArray(list.groups) ? list.groups : [],
    items, currency: list.currency ?? '', hideDone: !!list.hideDone, view: list.view === 'shop' ? 'shop' : 'group',
    shops: Array.isArray(list.shops) ? list.shops : [],
  };
}

/** Remembers the group in the list (name and emoji), so it travels with it. */
export function rememberGroup(list: ShoppingList, name: string, emoji: string): void {
  if (!name) return;
  const existing = list.groups.find((gr) => norm(gr.name) === norm(name));
  if (existing) existing.emoji ||= emoji;
  else list.groups.push({ name, emoji });
}

/** Phase 9l: same for a store. */
export function rememberShop(list: ShoppingList, name: string, emoji: string): void {
  if (!name) return;
  const existing = list.shops.find((s) => norm(s.name) === norm(name));
  if (existing) existing.emoji ||= emoji;
  else list.shops.push({ name, emoji });
}

/** Phase 9l: whether an item is taxed per the catalog: the item's setting, else its group's; if not found, yes. */
export function taxableIn(catalog: Catalog | null, groupName: string, productName: string): boolean {
  const found = findProduct(catalog, productName);
  if (found && norm(found.group.name) === norm(groupName)) return found.product.taxable ?? found.group.taxable;
  return findGroup(catalog, groupName)?.taxable ?? true;
}

/** "2 kg tomates", "tomates 2kg", "3 x leche", "leche x3": the quantity and unit typed next to the name. */
export function parseQuick(text: string): { name: string; qty: number | null; unit: string } {
  const unitRe = '(kg|g|gr|lb|lbs|oz|l|lt|ml|gal|u|un|pcs?|pack|doc|dozen|m|cm|ft)';
  const num = '(\\d+(?:[.,]\\d+)?)';
  let m = new RegExp(`^${num}\\s*(?:${unitRe}\\b|x)?\\s+(.+)$`, 'i').exec(text.trim());
  if (m) return { qty: parseNum(m[1]), unit: unitAlias(m[2] ?? ''), name: m[3].trim() };
  m = new RegExp(`^(.+?)\\s+(?:x\\s*)?${num}\\s*${unitRe}?$`, 'i').exec(text.trim());
  if (m) return { qty: parseNum(m[2]), unit: unitAlias(m[3] ?? ''), name: m[1].trim() };
  return { name: text.trim(), qty: null, unit: '' };
}

export const parseNum = (s: string | null | undefined): number | null => {
  if (s == null) return null;
  const v = parseFloat(String(s).trim().replace(',', '.'));
  return isFinite(v) ? v : null;
};

const ALIASES: Record<string, string> = { gr: 'g', lbs: 'lb', lt: 'L', l: 'L', un: 'u', pc: 'u', pcs: 'u', doc: 'dozen', kg: 'kg', g: 'g', lb: 'lb',
  oz: 'oz', ml: 'ml', gal: 'gal', u: 'u', pack: 'pack', dozen: 'dozen', m: 'm', cm: 'cm', ft: 'ft' };
const unitAlias = (u: string) => ALIASES[u.toLowerCase()] ?? u;

// ---------------------------------------------------------------------------------------------------------------------
// Units and prices

export const UNITS = ['', 'u', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'gal', 'fl oz', 'dozen', 'pack', 'm', 'cm', 'ft'];

/** Each unit in its dimension, with its factor to the base unit (g, ml, m, units). */
const DIM: Record<string, [string, number]> = {
  g: ['mass', 1], kg: ['mass', 1000], lb: ['mass', 453.59237], oz: ['mass', 28.349523125],
  ml: ['vol', 1], L: ['vol', 1000], gal: ['vol', 3785.411784], 'fl oz': ['vol', 29.5735295625],
  m: ['len', 1], cm: ['len', 0.01], ft: ['len', 0.3048],
  u: ['count', 1], dozen: ['count', 12], '': ['count', 1], pack: ['pack', 1],
};

export const sameDimension = (a: string, b: string) => (DIM[a]?.[0] ?? a) === (DIM[b]?.[0] ?? b);

/** How much <amount> <from> is in <to> (null if they cannot be compared). */
export function convert(amount: number, from: string, to: string): number | null {
  const f = DIM[from], t = DIM[to];
  if (!f || !t) return from === to ? amount : null;
  if (f[0] !== t[0]) return null;
  return amount * f[1] / t[1];
}

/** The unit to show the unit price in: kg for weight, L for volume, m for length. */
export function displayUnit(unit: string): string {
  const d = DIM[unit]?.[0];
  if (d === 'mass') return unit === 'lb' || unit === 'oz' ? 'lb' : 'kg';
  if (d === 'vol') return unit === 'gal' || unit === 'fl oz' ? 'gal' : 'L';
  if (d === 'len') return unit === 'ft' ? 'ft' : 'm';
  if (d === 'count') return 'u';
  return unit;
}

/** An offer's price per one <per> unit (e.g. $/kg), or null if data is missing or they cannot be compared. */
export function unitPrice(offer: Offer, per: string): number | null {
  if (offer.price == null) return null;
  const amount = offer.amount ?? 1;
  if (amount <= 0) return null;
  const inPer = convert(amount, offer.unit, per);
  return inPer == null || inPer <= 0 ? null : offer.price / inPer;
}

/** The unit to compare an item's offers in: the item's unit if it has one, else the first offer's. */
export function compareUnit(item: ListItem): string {
  const base = item.unit || item.offers.find((o) => o.price != null)?.unit || '';
  return displayUnit(base);
}

/** The cheapest offer per quantity (among comparable ones), or the only one. */
export function bestOffer(item: ListItem): Offer | null {
  const per = compareUnit(item);
  let best: Offer | null = null;
  let bestPrice = Infinity;
  for (const o of item.offers) {
    const p = unitPrice(o, per);
    if (p != null && p < bestPrice) { bestPrice = p; best = o; }
  }

  return best ?? item.offers.find((o) => o.price != null) ?? null;
}

/** The offer used for the total: the chosen one, or the cheapest. */
export const usedOffer = (item: ListItem) => item.offers.find((o) => o.id === item.chosen && o.price != null) ?? bestOffer(item);

/**
 * What the item will cost, using the offer in use. If the item and the offer have comparable units, unit price ×
 * requested quantity ("1.5 kg at $3/kg"); if the item has no unit, the quantity counts packages ("3 × $2").
 */
export function itemCost(item: ListItem): number | null {
  const offer = usedOffer(item);
  if (!offer || offer.price == null) return null;
  const qty = item.qty ?? 1;
  if (item.unit && offer.unit !== undefined && sameDimension(item.unit, offer.unit) && DIM[item.unit]) {
    const per = unitPrice(offer, item.unit);
    if (per != null) return per * qty;
  }

  return offer.price * qty;
}

/** Phase 9l: a store's tax (its own, or the general one), in %. */
export function taxRateFor(store: AppStore, shopName: string): number {
  const shop = findShop(store, shopName);
  return shop?.tax ?? store.settings.taxRate ?? 0;
}

export const findShop = (store: AppStore, name: string): Shop | undefined =>
  name ? store.shops.find((s) => norm(s.name) === norm(name)) : undefined;

/** Phase 9l: the tax an item pays (0 if untaxed or without a price). */
export function itemTax(item: ListItem, rate: number): number {
  const cost = itemCost(item);
  return cost == null || !item.taxable ? 0 : cost * rate / 100;
}

export interface Sum { subtotal: number; tax: number; total: number; priced: number; count: number; done: number;
  cartSubtotal: number; cartTax: number; cartTotal: number }

/** Totals for some items: subtotal, tax (at each item's store rate), total, and the same for the cart. */
export function sum(items: ListItem[], rateOf: (shop: string) => number): Sum {
  const s: Sum = { subtotal: 0, tax: 0, total: 0, priced: 0, count: items.length, done: 0, cartSubtotal: 0, cartTax: 0, cartTotal: 0 };
  for (const it of items) {
    if (it.done) s.done++;
    const c = itemCost(it);
    if (c == null) continue;
    const tax = itemTax(it, rateOf(it.shop));
    s.priced++;
    s.subtotal += c;
    s.tax += tax;
    if (it.done) { s.cartSubtotal += c; s.cartTax += tax; }
  }
  s.total = s.subtotal + s.tax;
  s.cartTotal = s.cartSubtotal + s.cartTax;
  return s;
}

export function totals(list: ShoppingList, rateOf: (shop: string) => number = () => 0) {
  const s = sum(list.items, rateOf);
  return { ...s, all: s.subtotal, cart: s.cartSubtotal };
}

/** Phase 9l: store order in the list: the app's store order; unknown stores next; no store last. */
export function shopOrder(list: ShoppingList, store: AppStore): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const used = new Set(list.items.map((i) => norm(i.shop)));
  const add = (name: string) => { const k = norm(name); if (used.has(k) && !seen.has(k)) { seen.add(k); order.push(name); } };
  for (const shop of store.shops) add(shop.name);
  for (const it of list.items) if (it.shop) add(it.shop);
  add('');
  return order;
}

export const money = (v: number | null, currency: string) =>
  v == null ? '' : currency + (Math.round(v * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1.5 kg", "3"; no quantity, nothing (a unit alone does not say how much). */
export const qtyText = (qty: number | null, unit: string) =>
  qty == null ? '' : `${+qty.toFixed(3)}${unit && unit !== 'u' ? ' ' + unit : ''}`;

// ---------------------------------------------------------------------------------------------------------------------
// List and catalog together

/** The list's catalog: its own (by id or by name), or the last one used. */
export function catalogOf(store: AppStore, list: ShoppingList): Catalog | null {
  return store.catalogs.find((c) => c.id === list.catalogId)
    ?? (list.catalogName ? store.catalogs.find((c) => norm(c.name) === norm(list.catalogName)) : undefined)
    ?? store.catalogs.find((c) => c.id === store.lastCatalog) ?? store.catalogs[0] ?? null;
}

/** What the list has that the catalog lacks (groups and items), e.g. a list sent by someone else. */
export function missingInCatalog(list: ShoppingList, catalogs: Catalog[]) {
  const groups = new Map<string, { name: string; emoji: string; taxable: boolean; products: { name: string; unit: string; taxable: boolean }[] }>();
  for (const it of list.items) {
    if (!it.group || !it.name) continue;
    // Phase 9l: a list can mix catalogs (a store with grocery and hardware): being in any of them is enough.
    const known = catalogs.some((c) => findGroup(c, it.group)?.products.some((p) => norm(p.name) === norm(it.name)));
    if (known) continue;
    const key = norm(it.group);
    const entry = groups.get(key) ?? { name: it.group, emoji: it.emoji || list.groups.find((g) => norm(g.name) === key)?.emoji || '•', taxable: it.taxable, products: [] };
    if (!entry.products.some((p) => norm(p.name) === norm(it.name))) entry.products.push({ name: it.name, unit: it.unit, taxable: it.taxable });
    groups.set(key, entry);
  }

  return [...groups.values()];
}

/** Group order in the list: the catalog's; unknown groups next (in the order they appear). */
export function groupOrder(list: ShoppingList, catalog: Catalog | null): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const add = (name: string) => { const k = norm(name); if (!seen.has(k)) { seen.add(k); order.push(name); } };
  const used = new Set(list.items.map((i) => norm(i.group)));
  for (const gr of catalog?.groups ?? []) if (used.has(norm(gr.name))) add(gr.name);
  for (const it of list.items) add(it.group);
  return order;
}
