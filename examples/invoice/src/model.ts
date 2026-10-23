// The data of an invoice (stored in the node) and of the business (stored in the app data: the same for every invoice),
// and the math. No DOM: it can be tested on its own.

export type Lang = 'es' | 'en' | 'fr';
export type DocKind = 'invoice' | 'quote' | 'receipt';
export type Status = 'draft' | 'sent' | 'paid';
export type TemplateId = 'classic' | 'modern' | 'minimal' | 'bold';
export type PageSize = 'letter' | 'a4';
/** What a column holds: free text, a number, or one of the values used to compute the line amount. */
export type ColumnKind = 'text' | 'number' | 'date' | 'qty' | 'price' | 'discount' | 'amount';

export interface Column { id: string; kind: ColumnKind; label: string }
export interface Item { id: string; cells: Record<string, string>; taxable: boolean }
/** A tax: name (GST, VAT...), rate, and the registration number if it is printed next to it (optional). */
export interface Tax { id: string; name: string; rate: number }
export interface TaxId { label: string; number: string }

export interface Business {
  name: string; address: string; phone: string; email: string; website: string; country: string;
  /** The logo (downscaled data: URL), or null. */
  logo: string | null;
  taxIds: TaxId[];
}

export interface Client { name: string; company: string; address: string; email: string; phone: string; taxId: string }

export interface Invoice {
  version: 1; kind: DocKind; number: string; date: string; dueDate: string; status: Status; language: Lang; currency: string;
  template: TemplateId; accent: string; pageSize: PageSize;
  /** The business as it was when the invoice was made (if it changes later, this copy does not). */
  from: Business;
  to: Client;
  columns: Column[]; items: Item[]; taxes: Tax[];
  discount: { type: 'percent' | 'amount'; value: number | null };
  paid: number | null; notes: string; terms: string;
}

/** The app data: the business and what is reused on every new invoice. */
export interface Profile {
  business: Business; currency: string; taxes: Tax[]; columns: Column[]; template: TemplateId; accent: string; pageSize: PageSize;
  prefix: string; nextNumber: number; dueDays: number; notes: string; terms: string;
  clients: Client[];
  /** Previously invoiced items (for suggestions): description and price. */
  items: { text: string; price: string }[];
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n: number) => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const addDays = (date: string, days: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3] + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// --- countries: the name of the tax number, the currency and the usual taxes ------------------------------------------------
export interface Country { code: string; taxIdLabel: string; currency: string; taxes: [string, number][] }

/** The taxes are suggestions (rates change; the user checks them). */
export const COUNTRIES: Country[] = [
  { code: 'CA', taxIdLabel: 'GST/HST #', currency: 'CAD', taxes: [['GST', 5], ['HST', 13], ['HST', 15], ['QST', 9.975], ['PST', 7], ['PST', 6]] },
  { code: 'US', taxIdLabel: 'EIN', currency: 'USD', taxes: [['Sales tax', 0]] },
  { code: 'MX', taxIdLabel: 'RFC', currency: 'MXN', taxes: [['IVA', 16], ['IVA', 8]] },
  { code: 'ES', taxIdLabel: 'NIF', currency: 'EUR', taxes: [['IVA', 21], ['IVA', 10], ['IVA', 4]] },
  { code: 'AR', taxIdLabel: 'CUIT', currency: 'ARS', taxes: [['IVA', 21], ['IVA', 10.5]] },
  { code: 'BO', taxIdLabel: 'NIT', currency: 'BOB', taxes: [['IVA', 13]] },
  { code: 'CL', taxIdLabel: 'RUT', currency: 'CLP', taxes: [['IVA', 19]] },
  { code: 'CO', taxIdLabel: 'NIT', currency: 'COP', taxes: [['IVA', 19], ['IVA', 5]] },
  { code: 'CR', taxIdLabel: 'Cédula jurídica', currency: 'CRC', taxes: [['IVA', 13]] },
  { code: 'CU', taxIdLabel: 'NIT', currency: 'CUP', taxes: [] },
  { code: 'DO', taxIdLabel: 'RNC', currency: 'DOP', taxes: [['ITBIS', 18]] },
  { code: 'EC', taxIdLabel: 'RUC', currency: 'USD', taxes: [['IVA', 15]] },
  { code: 'SV', taxIdLabel: 'NIT', currency: 'USD', taxes: [['IVA', 13]] },
  { code: 'GT', taxIdLabel: 'NIT', currency: 'GTQ', taxes: [['IVA', 12]] },
  { code: 'HN', taxIdLabel: 'RTN', currency: 'HNL', taxes: [['ISV', 15]] },
  { code: 'NI', taxIdLabel: 'RUC', currency: 'NIO', taxes: [['IVA', 15]] },
  { code: 'PA', taxIdLabel: 'RUC', currency: 'USD', taxes: [['ITBMS', 7]] },
  { code: 'PY', taxIdLabel: 'RUC', currency: 'PYG', taxes: [['IVA', 10], ['IVA', 5]] },
  { code: 'PE', taxIdLabel: 'RUC', currency: 'PEN', taxes: [['IGV', 18]] },
  { code: 'PR', taxIdLabel: 'EIN', currency: 'USD', taxes: [['IVU', 11.5]] },
  { code: 'UY', taxIdLabel: 'RUT', currency: 'UYU', taxes: [['IVA', 22], ['IVA', 10]] },
  { code: 'VE', taxIdLabel: 'RIF', currency: 'VES', taxes: [['IVA', 16]] },
  { code: 'BR', taxIdLabel: 'CNPJ', currency: 'BRL', taxes: [] },
  { code: 'GB', taxIdLabel: 'VAT Reg. No.', currency: 'GBP', taxes: [['VAT', 20], ['VAT', 5]] },
  { code: 'IE', taxIdLabel: 'VAT No.', currency: 'EUR', taxes: [['VAT', 23], ['VAT', 13.5]] },
  { code: 'FR', taxIdLabel: 'N° TVA', currency: 'EUR', taxes: [['TVA', 20], ['TVA', 10], ['TVA', 5.5]] },
  { code: 'BE', taxIdLabel: 'N° TVA', currency: 'EUR', taxes: [['TVA', 21], ['TVA', 6]] },
  { code: 'CH', taxIdLabel: 'IDE/UID', currency: 'CHF', taxes: [['TVA', 8.1]] },
  { code: 'DE', taxIdLabel: 'USt-IdNr.', currency: 'EUR', taxes: [['MwSt', 19], ['MwSt', 7]] },
  { code: 'IT', taxIdLabel: 'P.IVA', currency: 'EUR', taxes: [['IVA', 22], ['IVA', 10]] },
  { code: 'NL', taxIdLabel: 'Btw-id', currency: 'EUR', taxes: [['BTW', 21], ['BTW', 9]] },
  { code: 'PT', taxIdLabel: 'NIF', currency: 'EUR', taxes: [['IVA', 23], ['IVA', 6]] },
  { code: 'AU', taxIdLabel: 'ABN', currency: 'AUD', taxes: [['GST', 10]] },
  { code: 'NZ', taxIdLabel: 'GST No.', currency: 'NZD', taxes: [['GST', 15]] },
  { code: 'IN', taxIdLabel: 'GSTIN', currency: 'INR', taxes: [['GST', 18], ['GST', 5], ['GST', 12]] },
  { code: 'ZZ', taxIdLabel: 'Tax ID', currency: 'USD', taxes: [['Tax', 0]] },
];
export const countryOf = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];

/** The French tax number label in Canada (for French invoices from Quebec). */
export function taxIdLabelFor(country: string, lang: Lang): string {
  if (country === 'CA' && lang === 'fr') return 'N° TPS/TVH';
  return countryOf(country).taxIdLabel;
}

export const CURRENCIES = [...new Set(['USD', 'CAD', 'EUR', 'MXN', 'GBP', ...COUNTRIES.map((c) => c.currency)])];

// --- defaults ---------------------------------------------------------------------------------------------------------------
export function defaultColumns(): Column[] {
  return [
    { id: 'desc', kind: 'text', label: '' }, { id: 'qty', kind: 'qty', label: '' },
    { id: 'price', kind: 'price', label: '' }, { id: 'amount', kind: 'amount', label: '' },
  ];
}

export function emptyBusiness(country: string): Business {
  return { name: '', address: '', phone: '', email: '', website: '', country, logo: null, taxIds: [] };
}

/** The user's country, from the browser locale ("es-MX" → MX); if unknown, Mexico in Spanish, Canada in French, the US in English. */
export function guessCountry(locale: string, lang: Lang): string {
  const region = /[-_]([A-Z]{2})\b/i.exec(locale)?.[1]?.toUpperCase();
  if (region && COUNTRIES.some((c) => c.code === region)) return region;
  return lang === 'es' ? 'MX' : lang === 'fr' ? 'CA' : 'US';
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const arr = <T>(v: unknown, fn: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map((x) => fn(x as Record<string, unknown>)) : [];
const oneOf = <T extends string>(v: unknown, all: readonly T[], dflt: T): T => (all as readonly string[]).includes(str(v)) ? (v as T) : dflt;
const KINDS: ColumnKind[] = ['text', 'number', 'date', 'qty', 'price', 'discount', 'amount'];
const TEMPLATES: TemplateId[] = ['classic', 'modern', 'minimal', 'bold'];

function normBusiness(v: unknown, country: string): Business {
  const b = obj(v);
  return {
    name: str(b.name), address: str(b.address), phone: str(b.phone), email: str(b.email), website: str(b.website),
    country: str(b.country) || country, logo: typeof b.logo === 'string' && b.logo.startsWith('data:image/') ? b.logo : null,
    taxIds: arr(b.taxIds, (x) => ({ label: str(x.label), number: str(x.number) })),
  };
}
const normColumns = (v: unknown) => {
  const cols = arr(v, (x) => ({ id: str(x.id) || newId(), kind: oneOf(x.kind, KINDS, 'text'), label: str(x.label) }));
  return cols.length ? cols : defaultColumns();
};
const normTaxes = (v: unknown) => arr(v, (x) => ({ id: str(x.id) || newId(), name: str(x.name), rate: num(x.rate) ?? 0 }));
const normClient = (v: unknown): Client => {
  const c = obj(v);
  return { name: str(c.name), company: str(c.company), address: str(c.address), email: str(c.email), phone: str(c.phone), taxId: str(c.taxId) };
};

export function normalizeProfile(raw: unknown, country: string): Profile {
  const p = obj(raw);
  const business = normBusiness(p.business, country);
  const c = countryOf(business.country);
  return {
    business, currency: str(p.currency) || c.currency,
    taxes: Array.isArray(p.taxes) ? normTaxes(p.taxes) : c.taxes.slice(0, 1).map(([name, rate]) => ({ id: newId(), name, rate })),
    columns: normColumns(p.columns), template: oneOf(p.template, TEMPLATES, 'classic'), accent: str(p.accent) || '#1f6feb',
    pageSize: oneOf(p.pageSize, ['letter', 'a4'] as const, ['US', 'CA', 'MX', 'PR', 'ZZ'].includes(business.country) ? 'letter' : 'a4'),
    prefix: typeof p.prefix === 'string' ? p.prefix : 'INV-', nextNumber: Math.max(1, Math.floor(num(p.nextNumber) ?? 1)),
    dueDays: Math.max(0, Math.floor(num(p.dueDays) ?? 30)), notes: str(p.notes), terms: str(p.terms),
    clients: arr(p.clients, normClient).filter((x) => x.name || x.company),
    items: arr(p.items, (x) => ({ text: str(x.text), price: str(x.price) })).filter((x) => x.text).slice(0, 300),
  };
}

export function normalizeInvoice(raw: unknown, lang: Lang, country: string): Invoice {
  const r = obj(raw);
  const columns = normColumns(r.columns);
  return {
    version: 1, kind: oneOf(r.kind, ['invoice', 'quote', 'receipt'] as const, 'invoice'), number: str(r.number), date: str(r.date) || today(),
    dueDate: str(r.dueDate), status: oneOf(r.status, ['draft', 'sent', 'paid'] as const, 'draft'), language: oneOf(r.language, ['es', 'en', 'fr'] as const, lang),
    currency: str(r.currency) || countryOf(country).currency, template: oneOf(r.template, TEMPLATES, 'classic'), accent: str(r.accent) || '#1f6feb',
    pageSize: oneOf(r.pageSize, ['letter', 'a4'] as const, 'letter'), from: normBusiness(r.from, country), to: normClient(r.to),
    columns,
    items: arr(r.items, (x) => {
      const cells = obj(x.cells);
      return { id: str(x.id) || newId(), cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, str(v)])), taxable: x.taxable !== false };
    }),
    taxes: normTaxes(r.taxes),
    discount: { type: obj(r.discount).type === 'amount' ? 'amount' : 'percent', value: num(obj(r.discount).value) },
    paid: num(r.paid), notes: str(r.notes), terms: str(r.terms),
  };
}

/** A new invoice with the business data (and the next number: the caller increments <nextNumber>). */
export function newInvoice(profile: Profile, lang: Lang): Invoice {
  const date = today();
  return {
    version: 1, kind: 'invoice', number: profile.prefix + String(profile.nextNumber).padStart(4, '0'), date,
    dueDate: profile.dueDays ? addDays(date, profile.dueDays) : '', status: 'draft', language: lang, currency: profile.currency,
    template: profile.template, accent: profile.accent, pageSize: profile.pageSize, from: structuredClone(profile.business),
    to: { name: '', company: '', address: '', email: '', phone: '', taxId: '' },
    columns: structuredClone(profile.columns), items: [{ id: newId(), cells: {}, taxable: true }],
    taxes: profile.taxes.map((x) => ({ ...x, id: newId() })), discount: { type: 'percent', value: null }, paid: null,
    notes: profile.notes, terms: profile.terms,
  };
}

// --- the math ---------------------------------------------------------------------------------------------------------------

/** A number typed by the user ("12,5", "1.234,50", "$1,234.50", "15%"), or null. */
export function parseNum(text: string): number | null {
  const m = /-?\d[\d.,\s]*/.exec(String(text ?? ''));
  if (!m) return null;
  let s = m[0].replace(/\s+/g, '').replace(/[.,]$/, '');
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) s = dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (comma >= 0) s = (s.match(/,/g)!.length === 1 && s.length - comma - 1 !== 3) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (dot >= 0 && s.match(/\./g)!.length > 1) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isFinite(v) ? v : null;
}

export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * The amount of a line: quantity × price × (1 − discount %). With no quantity column, 1; with no price column, whatever
 * was typed in the amount column. null if there is nothing to compute it from.
 */
export function itemAmount(inv: Pick<Invoice, 'columns'>, item: Item): number | null {
  const col = (k: ColumnKind) => inv.columns.find((c) => c.kind === k);
  const val = (k: ColumnKind) => { const c = col(k); return c ? parseNum(item.cells[c.id] ?? '') : null; };
  const priceCol = col('price');
  if (!priceCol) return val('amount');
  const price = val('price');
  if (price == null) return null;
  const qty = col('qty') ? val('qty') : 1;
  if (qty == null) return null;
  const disc = val('discount') ?? 0;
  return round2(qty * price * (1 - disc / 100));
}

export interface Totals {
  subtotal: number; discount: number; taxable: number;
  taxes: { tax: Tax; amount: number }[];
  total: number; paid: number; balance: number;
}

export function totals(inv: Invoice): Totals {
  let subtotal = 0;
  let taxableSub = 0;
  for (const item of inv.items) {
    const a = itemAmount(inv, item) ?? 0;
    subtotal += a;
    if (item.taxable) taxableSub += a;
  }
  subtotal = round2(subtotal);
  const d = inv.discount.value ?? 0;
  const discount = round2(Math.min(subtotal, Math.max(0, inv.discount.type === 'percent' ? subtotal * d / 100 : d)));
  // The discount is spread out: the taxable part goes down in the same proportion.
  const ratio = subtotal > 0 ? (subtotal - discount) / subtotal : 1;
  const taxable = round2(taxableSub * ratio);
  const taxes = inv.taxes.filter((x) => x.name || x.rate).map((tax) => ({ tax, amount: round2(taxable * tax.rate / 100) }));
  const total = round2(subtotal - discount + taxes.reduce((s, x) => s + x.amount, 0));
  const paid = round2(inv.paid ?? (inv.status === 'paid' ? total : 0));
  return { subtotal, discount, taxable, taxes, total, paid, balance: round2(total - paid) };
}

/** Money in the invoice language and country format ("$1,234.50", "1 234,50 $", "1.234,50 €"). */
export function moneyFormat(inv: Pick<Invoice, 'language' | 'currency' | 'from'>): (v: number) => string {
  const locale = `${inv.language}-${inv.from.country && inv.from.country !== 'ZZ' ? inv.from.country : inv.language === 'en' ? 'US' : inv.language.toUpperCase()}`;
  let f: Intl.NumberFormat;
  try { f = new Intl.NumberFormat(locale, { style: 'currency', currency: inv.currency || 'USD', currencyDisplay: 'narrowSymbol' }); }
  catch { f = new Intl.NumberFormat(inv.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  return (v) => f.format(v).replace(/ | /g, ' ');
}

/** Saves a client in the client book (replaces the one with the same name/company). */
export function rememberClient(profile: Profile, client: Client): void {
  if (!client.name.trim() && !client.company.trim()) return;
  const key = (c: Client) => (c.name.trim() + '|' + c.company.trim()).toLowerCase();
  profile.clients = [structuredClone(client), ...profile.clients.filter((c) => key(c) !== key(client))].slice(0, 200);
}

/** Remembers invoiced items (description and price) to suggest them later. */
export function rememberItems(profile: Profile, inv: Invoice): void {
  const desc = inv.columns.find((c) => c.kind === 'text');
  const price = inv.columns.find((c) => c.kind === 'price');
  if (!desc) return;
  for (const item of inv.items) {
    const text = (item.cells[desc.id] ?? '').trim();
    if (!text) continue;
    profile.items = [{ text, price: price ? (item.cells[price.id] ?? '') : '' }, ...profile.items.filter((x) => x.text.toLowerCase() !== text.toLowerCase())];
  }
  profile.items = profile.items.slice(0, 300);
}
