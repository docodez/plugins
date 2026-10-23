// Los datos de la lista de compras (van en el nodo) y de los catálogos (van en la app: docodez.getAppJSON), y las cuentas
// de precios. Sin DOM: se puede probar suelto.
import { FOOD_GROUPS, type Lang, type SeedId, seedCatalog } from './seed';

// ---------------------------------------------------------------------------------------------------------------------
// Catálogos (datos de la APP, no del documento: los mismos para todas las listas)

/** Fase 9l: <taxable> null = como su grupo. */
export interface CatalogProduct { id: string; name: string; unit: string; uses: number; taxable: boolean | null }
/** Fase 9l: <taxable> = sus productos pagan impuestos (la comida, no). */
export interface CatalogGroup { id: string; name: string; emoji: string; taxable: boolean; products: CatalogProduct[] }
export interface Catalog { id: string; name: string; emoji: string; groups: CatalogGroup[] }
/** Fase 9l: una tienda, con los catálogos de lo que vende (p.ej. supermercado y ferretería) y su impuesto si es otro. */
export interface Shop { id: string; name: string; emoji: string; catalogIds: string[]; tax: number | null }
/** Fase 9l: ajustes del plugin. <taxRate> en % (8.25 = 8,25 %). */
export interface Settings { taxRate: number; currency: string }
/** Fase 11e: una cuenta de la calculadora (la historia, la más nueva primero). */
export interface CalcEntry { expr: string; result: string; at: number }
export const CALC_HISTORY_MAX = 100;

export interface AppStore {
  version: 2; catalogs: Catalog[]; lastCatalog: string | null; shops: Shop[]; lastShop: string | null; settings: Settings;
  /** Fase 11e: las últimas cuentas de la calculadora (de todas las listas). */
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

/** Los datos de la app de este plugin, con el supermercado la primera vez. */
export function normalizeStore(raw: unknown, lang: Lang): AppStore {
  const store = raw as Partial<AppStore> | null;
  const settings: Settings = { taxRate: 0, currency: '$', ...(store?.settings ?? {}) };
  if (store && Array.isArray(store.catalogs)) {
    for (const c of store.catalogs) {
      c.id ||= newId(); c.groups ??= []; c.emoji ||= '🛍️';
      for (const gr of c.groups) {
        gr.id ||= newId(); gr.products ??= []; gr.emoji ||= '•';
        // Fase 9l: un catálogo de antes no sabe de impuestos: los grupos de comida de las plantillas, sin.
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

/** Productos del catálogo que contienen el texto (primero los que empiezan con él, después los más usados). */
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

/** Los más usados del catálogo. */
export function frequent(catalog: Catalog | null, max = 12) {
  const all = (catalog?.groups ?? []).flatMap((group) => group.products.filter((p) => p.uses > 0).map((product) => ({ group, product })));
  return all.sort((a, b) => b.product.uses - a.product.uses).slice(0, max);
}

/** Agrega al catálogo un grupo (si no está, con ese emoji) y un producto (si no está). Devuelve si cambió algo. */
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
// La lista (datos del NODO). Cada producto lleva el nombre y el emoji de su grupo: así la lista se entiende aunque se abra
// en otro Docodez con otros catálogos (y se ofrece agregar lo que falte).

export interface Offer { id: string; store: string; price: number | null; amount: number | null; unit: string }
/**
 * Un producto de la lista. Fase 9l: <shop> = la tienda donde se piensa comprar (o donde se compró: la de la oferta elegida
 * como precio de compra); <taxable> = paga impuestos (se copia del catálogo al agregarlo, así viaja con la lista).
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
  /** Fase 9l: cómo se ve la lista: por grupo (como en el catálogo) o por tienda. */
  view: 'group' | 'shop';
  /** Fase 9l: las tiendas que usa la lista (nombre y emoji), para que viajen con ella como los grupos. */
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

/** Recuerda el grupo en la lista (nombre y emoji), para que viaje con ella. */
export function rememberGroup(list: ShoppingList, name: string, emoji: string): void {
  if (!name) return;
  const existing = list.groups.find((gr) => norm(gr.name) === norm(name));
  if (existing) existing.emoji ||= emoji;
  else list.groups.push({ name, emoji });
}

/** Fase 9l: lo mismo con una tienda. */
export function rememberShop(list: ShoppingList, name: string, emoji: string): void {
  if (!name) return;
  const existing = list.shops.find((s) => norm(s.name) === norm(name));
  if (existing) existing.emoji ||= emoji;
  else list.shops.push({ name, emoji });
}

/** Fase 9l: si un producto paga impuestos según el catálogo: el del producto, si no el de su grupo; si no está, sí. */
export function taxableIn(catalog: Catalog | null, groupName: string, productName: string): boolean {
  const found = findProduct(catalog, productName);
  if (found && norm(found.group.name) === norm(groupName)) return found.product.taxable ?? found.group.taxable;
  return findGroup(catalog, groupName)?.taxable ?? true;
}

/** "2 kg tomates", "tomates 2kg", "3 x leche", "leche x3": la cantidad y la unidad escritas junto al nombre. */
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
// Unidades y precios

export const UNITS = ['', 'u', 'kg', 'g', 'lb', 'oz', 'L', 'ml', 'gal', 'fl oz', 'dozen', 'pack', 'm', 'cm', 'ft'];

/** Cada unidad en su dimensión, con su factor a la base (g, ml, m, unidades). */
const DIM: Record<string, [string, number]> = {
  g: ['mass', 1], kg: ['mass', 1000], lb: ['mass', 453.59237], oz: ['mass', 28.349523125],
  ml: ['vol', 1], L: ['vol', 1000], gal: ['vol', 3785.411784], 'fl oz': ['vol', 29.5735295625],
  m: ['len', 1], cm: ['len', 0.01], ft: ['len', 0.3048],
  u: ['count', 1], dozen: ['count', 12], '': ['count', 1], pack: ['pack', 1],
};

export const sameDimension = (a: string, b: string) => (DIM[a]?.[0] ?? a) === (DIM[b]?.[0] ?? b);

/** Cuánto es <amount> <from> en <to> (null si no se pueden comparar). */
export function convert(amount: number, from: string, to: string): number | null {
  const f = DIM[from], t = DIM[to];
  if (!f || !t) return from === to ? amount : null;
  if (f[0] !== t[0]) return null;
  return amount * f[1] / t[1];
}

/** La unidad en que conviene mostrar el precio por cantidad: kg para pesos, L para volumen, m para largos. */
export function displayUnit(unit: string): string {
  const d = DIM[unit]?.[0];
  if (d === 'mass') return unit === 'lb' || unit === 'oz' ? 'lb' : 'kg';
  if (d === 'vol') return unit === 'gal' || unit === 'fl oz' ? 'gal' : 'L';
  if (d === 'len') return unit === 'ft' ? 'ft' : 'm';
  if (d === 'count') return 'u';
  return unit;
}

/** El precio por una unidad de <per> de una oferta (p.ej. $/kg), o null si faltan datos o no se pueden comparar. */
export function unitPrice(offer: Offer, per: string): number | null {
  if (offer.price == null) return null;
  const amount = offer.amount ?? 1;
  if (amount <= 0) return null;
  const inPer = convert(amount, offer.unit, per);
  return inPer == null || inPer <= 0 ? null : offer.price / inPer;
}

/** La unidad para comparar las ofertas de un producto: la del producto si tiene, si no la de la primera oferta. */
export function compareUnit(item: ListItem): string {
  const base = item.unit || item.offers.find((o) => o.price != null)?.unit || '';
  return displayUnit(base);
}

/** La oferta más barata por cantidad (comparables), o la única. */
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

/** La oferta que se usa para la cuenta: la elegida, o la más barata. */
export const usedOffer = (item: ListItem) => item.offers.find((o) => o.id === item.chosen && o.price != null) ?? bestOffer(item);

/**
 * Lo que va a costar el producto: con la oferta usada. Si el producto y la oferta tienen unidades comparables, precio por
 * cantidad × cantidad pedida ("1.5 kg a $3/kg"); si el producto no tiene unidad, la cantidad es de paquetes ("3 × $2").
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

/** Fase 9l: el impuesto de una tienda (el suyo, o el general), en %. */
export function taxRateFor(store: AppStore, shopName: string): number {
  const shop = findShop(store, shopName);
  return shop?.tax ?? store.settings.taxRate ?? 0;
}

export const findShop = (store: AppStore, name: string): Shop | undefined =>
  name ? store.shops.find((s) => norm(s.name) === norm(name)) : undefined;

/** Fase 9l: lo que paga de impuesto un producto (0 si no paga, o sin precio). */
export function itemTax(item: ListItem, rate: number): number {
  const cost = itemCost(item);
  return cost == null || !item.taxable ? 0 : cost * rate / 100;
}

export interface Sum { subtotal: number; tax: number; total: number; priced: number; count: number; done: number;
  cartSubtotal: number; cartTax: number; cartTotal: number }

/** Las cuentas de unos productos: subtotal, impuestos (con la tasa de la tienda de cada uno), total, y lo del carro. */
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

/** Fase 9l: el orden de las tiendas en la lista: el de las tiendas de la app; las que no están, después; sin tienda, al final. */
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

/** "1.5 kg", "3"; sin cantidad, nada (la unidad sola no dice cuánto). */
export const qtyText = (qty: number | null, unit: string) =>
  qty == null ? '' : `${+qty.toFixed(3)}${unit && unit !== 'u' ? ' ' + unit : ''}`;

// ---------------------------------------------------------------------------------------------------------------------
// Lista y catálogo juntos

/** El catálogo de la lista: el suyo (por id o por nombre), o el último usado. */
export function catalogOf(store: AppStore, list: ShoppingList): Catalog | null {
  return store.catalogs.find((c) => c.id === list.catalogId)
    ?? (list.catalogName ? store.catalogs.find((c) => norm(c.name) === norm(list.catalogName)) : undefined)
    ?? store.catalogs.find((c) => c.id === store.lastCatalog) ?? store.catalogs[0] ?? null;
}

/** Lo de la lista que no está en el catálogo (grupos y productos), p.ej. una lista que mandó otra persona. */
export function missingInCatalog(list: ShoppingList, catalogs: Catalog[]) {
  const groups = new Map<string, { name: string; emoji: string; taxable: boolean; products: { name: string; unit: string; taxable: boolean }[] }>();
  for (const it of list.items) {
    if (!it.group || !it.name) continue;
    // Fase 9l: una lista puede mezclar catálogos (una tienda con súper y ferretería): basta con que esté en alguno.
    const known = catalogs.some((c) => findGroup(c, it.group)?.products.some((p) => norm(p.name) === norm(it.name)));
    if (known) continue;
    const key = norm(it.group);
    const entry = groups.get(key) ?? { name: it.group, emoji: it.emoji || list.groups.find((g) => norm(g.name) === key)?.emoji || '•', taxable: it.taxable, products: [] };
    if (!entry.products.some((p) => norm(p.name) === norm(it.name))) entry.products.push({ name: it.name, unit: it.unit, taxable: it.taxable });
    groups.set(key, entry);
  }

  return [...groups.values()];
}

/** El orden de los grupos en la lista: el del catálogo; los que no están, después (en el orden en que aparecen). */
export function groupOrder(list: ShoppingList, catalog: Catalog | null): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const add = (name: string) => { const k = norm(name); if (!seen.has(k)) { seen.add(k); order.push(name); } };
  const used = new Set(list.items.map((i) => norm(i.group)));
  for (const gr of catalog?.groups ?? []) if (used.has(norm(gr.name))) add(gr.name);
  for (const it of list.items) add(it.group);
  return order;
}
