// Los datos de la bitácora del carro (van en el nodo: docodez.getJSON / setJSON; fotos y facturas, como anexos) y las
// cuentas (consumo, gastos). Sin DOM: se puede probar suelto.

export type DistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'L' | 'gal';
/** Cómo se muestra el consumo: litros cada 100 km (per100) o km por litro / millas por galón (perVolume). */
export type Economy = 'per100' | 'perVolume';

export interface Settings { distance: DistanceUnit; volume: VolumeUnit; currency: string; economy: Economy }

export interface Car {
  name: string; make: string; model: string; year: string; trim: string; vin: string; plate: string; color: string;
  fuelType: string; engine: string; tank: number | null; purchaseDate: string; purchaseOdometer: number | null; notes: string;
  /** Anexo con la foto del carro, o null. */
  photo: string | null;
}

/** Una carga de combustible. <full> = se llenó el tanque; <missed> = antes de esta hubo una carga que no se anotó. */
export interface FuelEntry {
  id: string; date: string; odometer: number | null; volume: number | null; price: number | null; total: number | null;
  full: boolean; missed: boolean; station: string; note: string; files: string[];
}

export interface Repair {
  id: string; title: string; start: string; end: string; odometer: number | null; mechanic: string; shop: string;
  cost: number | null; html: string; files: string[];
}

export type PartKind = 'tires' | 'wipers' | 'bulbs' | 'oil' | 'filters' | 'battery' | 'brakes' | 'fluids' | 'other';
export const PART_KINDS: PartKind[] = ['tires', 'wipers', 'bulbs', 'oil', 'filters', 'battery', 'brakes', 'fluids', 'other'];
export const PART_EMOJI: Record<PartKind, string> = {
  tires: '🛞', wipers: '🌧️', bulbs: '💡', oil: '🛢️', filters: '🌀', battery: '🔋', brakes: '🛑', fluids: '💧', other: '🔩',
};

/** Una pieza o accesorio: qué es (marca, medida/número de parte) y para qué (invierno, delantera izquierda, carrera...). */
export interface Part {
  id: string; kind: PartKind; name: string; brand: string; spec: string; use: string; date: string; odometer: number | null;
  cost: number | null; where: string; note: string; files: string[];
}

export interface Trip {
  id: string; title: string; start: string; end: string; from: string; to: string; odoStart: number | null; odoEnd: number | null;
  html: string; files: string[];
}

export interface Note { id: string; title: string; date: string; html: string; files: string[] }

/** Una vez que se hizo un mantenimiento (fecha y odómetro). */
export interface Done { date: string; odometer: number | null }

/**
 * Un mantenimiento que se repite (cambio de aceite, rotar las gomas, el seguro...): cada tanta distancia y/o cada tantos
 * meses, desde la última vez. <history>: las veces anteriores (la última es <last>).
 */
export interface Maintenance {
  id: string; title: string; icon: string; everyDistance: number | null; everyMonths: number | null; last: Done | null; history: Done[]; note: string;
}

export interface CarLog {
  version: 1; car: Car; settings: Settings;
  fuel: FuelEntry[]; repairs: Repair[]; parts: Part[]; trips: Trip[]; notes: Note[];
  /** Fase 11g: los mantenimientos con aviso. */
  maintenance: Maintenance[];
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const pad = (n: number) => String(n).padStart(2, '0');

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const files = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const done = (v: unknown): Done | null => {
  const d = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  return d && (str(d.date) || num(d.odometer) != null) ? { date: str(d.date), odometer: num(d.odometer) } : null;
};
const arr = <T>(v: unknown, fn: (x: Record<string, unknown>) => T): T[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map((x) => fn(x as Record<string, unknown>)) : [];

/** Los datos del nodo, completos (lo que falte, con su valor por omisión). */
export function normalizeLog(raw: unknown, defaults?: Partial<Settings>): CarLog {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (r.car && typeof r.car === 'object' ? r.car : {}) as Record<string, unknown>;
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const settings: Settings = {
    distance: s.distance === 'mi' ? 'mi' : s.distance === 'km' ? 'km' : defaults?.distance ?? 'km',
    volume: s.volume === 'gal' ? 'gal' : s.volume === 'L' ? 'L' : defaults?.volume ?? 'L',
    currency: typeof s.currency === 'string' && s.currency ? s.currency : defaults?.currency ?? '$',
    economy: s.economy === 'perVolume' ? 'perVolume' : s.economy === 'per100' ? 'per100' : defaults?.economy ?? 'per100',
  };
  return {
    version: 1,
    car: {
      name: str(c.name), make: str(c.make), model: str(c.model), year: str(c.year), trim: str(c.trim), vin: str(c.vin),
      plate: str(c.plate), color: str(c.color), fuelType: str(c.fuelType), engine: str(c.engine), tank: num(c.tank),
      purchaseDate: str(c.purchaseDate), purchaseOdometer: num(c.purchaseOdometer), notes: str(c.notes),
      photo: typeof c.photo === 'string' && c.photo ? c.photo : null,
    },
    settings,
    fuel: arr(r.fuel, (x) => ({
      id: str(x.id) || newId(), date: str(x.date), odometer: num(x.odometer), volume: num(x.volume), price: num(x.price),
      total: num(x.total), full: x.full !== false, missed: x.missed === true, station: str(x.station), note: str(x.note), files: files(x.files),
    })),
    repairs: arr(r.repairs, (x) => ({
      id: str(x.id) || newId(), title: str(x.title), start: str(x.start), end: str(x.end), odometer: num(x.odometer),
      mechanic: str(x.mechanic), shop: str(x.shop), cost: num(x.cost), html: str(x.html), files: files(x.files),
    })),
    parts: arr(r.parts, (x) => ({
      id: str(x.id) || newId(), kind: (PART_KINDS as string[]).includes(str(x.kind)) ? (x.kind as PartKind) : 'other',
      name: str(x.name), brand: str(x.brand), spec: str(x.spec), use: str(x.use), date: str(x.date), odometer: num(x.odometer),
      cost: num(x.cost), where: str(x.where), note: str(x.note), files: files(x.files),
    })),
    trips: arr(r.trips, (x) => ({
      id: str(x.id) || newId(), title: str(x.title), start: str(x.start), end: str(x.end), from: str(x.from), to: str(x.to),
      odoStart: num(x.odoStart), odoEnd: num(x.odoEnd), html: str(x.html), files: files(x.files),
    })),
    notes: arr(r.notes, (x) => ({ id: str(x.id) || newId(), title: str(x.title), date: str(x.date), html: str(x.html), files: files(x.files) })),
    maintenance: arr(r.maintenance, (x) => ({
      id: str(x.id) || newId(), title: str(x.title), icon: str(x.icon) || '🛠️', everyDistance: num(x.everyDistance), everyMonths: num(x.everyMonths),
      last: done(x.last), history: arr(x.history, (h) => done(h)).filter((h): h is Done => h != null), note: str(x.note),
    })),
  };
}

/** Un número escrito por la persona ("12,5", "1.234,5", "1,234.5", "45 L"), o null. */
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

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export type FuelField = 'volume' | 'price' | 'total';

/**
 * Completa una carga: de dos de los tres (cantidad, precio por unidad, total) sale el tercero. <edited>: los dos que la
 * persona escribió último (el más reciente primero); se calcula el otro.
 */
export function completeFuel(e: Pick<FuelEntry, FuelField>, edited: FuelField[]): FuelField | null {
  if (edited.length < 2 || edited[0] === edited[1]) return null;
  const target = (['volume', 'price', 'total'] as FuelField[]).find((f) => !edited.slice(0, 2).includes(f))!;
  const { volume, price, total } = e;
  if (target === 'total' && volume != null && price != null) e.total = round(volume * price, 2);
  else if (target === 'volume' && price != null && price > 0 && total != null) e.volume = round(total / price, 3);
  else if (target === 'price' && volume != null && volume > 0 && total != null) e.price = round(total / volume, 3);
  else return null;
  return target;
}

/** Las cargas en orden (kilometraje, si no fecha). */
export function fuelOrder(entries: FuelEntry[]): FuelEntry[] {
  return [...entries].sort((a, b) =>
    a.odometer != null && b.odometer != null && a.odometer !== b.odometer ? a.odometer - b.odometer : a.date.localeCompare(b.date));
}

/** Un tramo entre dos tanques llenos: la distancia, lo cargado (sin contar el primer lleno) y lo pagado. */
export interface Segment { entryId: string; date: string; distance: number; volume: number; cost: number | null }

/**
 * El consumo por el método de tanque lleno: entre dos cargas con el tanque lleno se gastó lo que se cargó después de la
 * primera (las parciales del medio y la última, la que vuelve a llenar). Una carga marcada "faltó anotar una antes" corta:
 * no se sabe cuánto se cargó, así que ese tramo no cuenta.
 */
export function fuelSegments(entries: FuelEntry[]): Segment[] {
  const segments: Segment[] = [];
  let last: FuelEntry | null = null;
  let volume = 0;
  let cost: number | null = 0;
  for (const e of fuelOrder(entries)) {
    if (e.missed) { last = null; volume = 0; cost = 0; }
    volume += e.volume ?? 0;
    cost = cost == null || e.total == null ? null : cost + e.total;
    if (!e.full) continue;
    if (last && last.odometer != null && e.odometer != null && e.odometer > last.odometer && volume > 0) {
      segments.push({ entryId: e.id, date: e.date, distance: e.odometer - last.odometer, volume, cost });
    }
    last = e.odometer != null ? e : null;
    volume = 0;
    cost = 0;
  }
  return segments;
}

export interface FuelStats {
  /** Consumo medio: volumen por distancia (L/km o gal/mi), o null si todavía no hay dos tanques llenos. */
  average: number | null; last: number | null; best: number | null; worst: number | null;
  /** Costo de combustible por unidad de distancia. */
  costPerDistance: number | null;
  totalCost: number; totalVolume: number; count: number; distance: number | null; averagePrice: number | null;
  segments: Segment[];
}

export function fuelStats(entries: FuelEntry[]): FuelStats {
  const segments = fuelSegments(entries);
  const rates = segments.map((s) => s.volume / s.distance);
  const dist = segments.reduce((a, s) => a + s.distance, 0);
  const vol = segments.reduce((a, s) => a + s.volume, 0);
  const costed = segments.filter((s) => s.cost != null);
  const costDist = costed.reduce((a, s) => a + s.distance, 0);
  const odos = entries.map((e) => e.odometer).filter((o): o is number => o != null);
  const totalVolume = entries.reduce((a, e) => a + (e.volume ?? 0), 0);
  const totalCost = entries.reduce((a, e) => a + (e.total ?? 0), 0);
  const priced = entries.filter((e) => e.volume != null && e.total != null);
  const pricedVolume = priced.reduce((a, e) => a + e.volume!, 0);
  return {
    average: dist > 0 ? vol / dist : null,
    last: rates.length ? rates[rates.length - 1] : null,
    best: rates.length ? Math.min(...rates) : null,
    worst: rates.length ? Math.max(...rates) : null,
    costPerDistance: costDist > 0 ? costed.reduce((a, s) => a + s.cost!, 0) / costDist : null,
    totalCost, totalVolume, count: entries.length,
    distance: odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : null,
    averagePrice: pricedVolume > 0 ? priced.reduce((a, e) => a + e.total!, 0) / pricedVolume : null,
    segments,
  };
}

/** Lo gastado por año (combustible, reparaciones, piezas), del más nuevo al más viejo. */
export function spendingByYear(log: CarLog): { year: string; fuel: number; repairs: number; parts: number }[] {
  const years = new Map<string, { fuel: number; repairs: number; parts: number }>();
  const add = (date: string, key: 'fuel' | 'repairs' | 'parts', v: number | null) => {
    if (v == null) return;
    const y = /^\d{4}/.exec(date)?.[0] ?? '—';
    const row = years.get(y) ?? { fuel: 0, repairs: 0, parts: 0 };
    row[key] += v;
    years.set(y, row);
  };
  log.fuel.forEach((e) => add(e.date, 'fuel', e.total));
  log.repairs.forEach((r) => add(r.start || r.end, 'repairs', r.cost));
  log.parts.forEach((p) => add(p.date, 'parts', p.cost));
  return [...years].map(([year, v]) => ({ year, ...v })).sort((a, b) => b.year.localeCompare(a.year));
}

/** El kilometraje más alto anotado en cualquier lado (o null). */
export function currentOdometer(log: CarLog): number | null {
  const all = [
    log.car.purchaseOdometer, ...log.fuel.map((e) => e.odometer), ...log.repairs.map((r) => r.odometer),
    ...log.parts.map((p) => p.odometer), ...log.trips.flatMap((t) => [t.odoStart, t.odoEnd]),
    ...log.maintenance.map((m) => m.last?.odometer ?? null),
  ].filter((v): v is number => v != null);
  return all.length ? Math.max(...all) : null;
}

export const KM_PER_MI = 1.609344;
export const L_PER_GAL = 3.785411784;

/**
 * Cambiar las unidades del carro: pasa todo lo anotado (kilometrajes, cantidades, precios por unidad, tanque) a las
 * nuevas, así las cuentas siguen bien.
 */
export function convertUnits(log: CarLog, distance: DistanceUnit, volume: VolumeUnit): void {
  const d = log.settings.distance === distance ? 1 : distance === 'km' ? KM_PER_MI : 1 / KM_PER_MI;
  const v = log.settings.volume === volume ? 1 : volume === 'L' ? L_PER_GAL : 1 / L_PER_GAL;
  const dd = (x: number | null) => (x == null ? null : round(x * d, 1));
  const vv = (x: number | null) => (x == null ? null : round(x * v, 3));
  for (const e of log.fuel) { e.odometer = dd(e.odometer); e.volume = vv(e.volume); e.price = e.price == null ? null : round(e.price / v, 3); }
  for (const r of log.repairs) r.odometer = dd(r.odometer);
  for (const p of log.parts) p.odometer = dd(p.odometer);
  for (const t of log.trips) { t.odoStart = dd(t.odoStart); t.odoEnd = dd(t.odoEnd); }
  for (const m of log.maintenance) {
    m.everyDistance = m.everyDistance == null ? null : Math.round(m.everyDistance * d);
    for (const h of [m.last, ...m.history]) if (h) h.odometer = dd(h.odometer);
  }
  log.car.purchaseOdometer = dd(log.car.purchaseOdometer);
  log.car.tank = vv(log.car.tank);
  log.settings.distance = distance;
  log.settings.volume = volume;
}

/** El consumo (volumen por distancia) como se muestra: "7.4 L/100 km", "13.5 km/L", "31.2 mpg". */
export function economyText(rate: number | null, s: Settings): string {
  if (rate == null || !(rate > 0)) return '—';
  if (s.economy === 'per100') return `${fmt(rate * 100, 1)} ${s.volume}/100 ${s.distance}`;
  const per = 1 / rate;
  return `${fmt(per, 1)} ${s.distance === 'mi' && s.volume === 'gal' ? 'mpg' : `${s.distance}/${s.volume}`}`;
}

export const fmt = (v: number, decimals = 0) =>
  v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const money = (v: number | null, currency: string) => (v == null ? '—' : `${currency}${fmt(v, 2)}`);

/** El nombre del carro para mostrar: el que le puso la persona, si no año + marca + modelo. */
export const carTitle = (car: Car) => car.name.trim() || [car.year, car.make, car.model].filter((x) => x.trim()).join(' ');

/** Todos los anexos que usa la bitácora (para no borrar uno que está en uso). */
export function usedFiles(log: CarLog): Set<string> {
  const used = new Set<string>();
  if (log.car.photo) used.add(log.car.photo);
  for (const list of [log.fuel, log.repairs, log.parts, log.trips, log.notes]) for (const x of list) x.files.forEach((f) => used.add(f));
  return used;
}

// --- Fase 11g: mantenimiento -------------------------------------------------------------------------------------------------

/** Cuánto se maneja por día (de las cargas y lo demás con fecha y odómetro: el más viejo y el más nuevo), o null. */
export function distancePerDay(log: CarLog): number | null {
  const points = [
    ...log.fuel.map((e) => [e.date, e.odometer] as const), ...log.repairs.map((r) => [r.start || r.end, r.odometer] as const),
    ...log.parts.map((p) => [p.date, p.odometer] as const), ...log.maintenance.flatMap((m) => [m.last, ...m.history].map((h) => [h?.date ?? '', h?.odometer ?? null] as const)),
  ].map(([d, o]) => [Date.parse(d + 'T00:00:00'), o] as const).filter(([d, o]) => isFinite(d) && o != null) as [number, number][];
  if (points.length < 2) return null;
  points.sort((a, b) => a[0] - b[0]);
  const [d0, o0] = points[0];
  const [d1, o1] = points[points.length - 1];
  const days = (d1 - d0) / 86400000;
  return days >= 7 && o1 > o0 ? (o1 - o0) / days : null;
}

export const addMonths = (date: string, months: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1 + months, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(+m[3], last));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export type DueState = 'overdue' | 'soon' | 'ok' | 'unknown';

/** Cuándo toca: lo que falta en distancia y en días (lo primero que llegue manda), y el estado. */
export interface DueInfo {
  state: DueState; dueOdometer: number | null; dueDate: string; distanceLeft: number | null; daysLeft: number | null;
  /** Días estimados hasta la distancia (con lo que se maneja por día). */
  daysByDistance: number | null;
}

export function dueInfo(m: Maintenance, odometer: number | null, perDay: number | null, now = new Date()): DueInfo {
  const dueOdometer = m.everyDistance && m.last?.odometer != null ? m.last.odometer + m.everyDistance : null;
  const dueDate = m.everyMonths && m.last?.date ? addMonths(m.last.date, m.everyMonths) : '';
  const distanceLeft = dueOdometer != null && odometer != null ? dueOdometer - odometer : null;
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysLeft = dueDate ? Math.round((Date.parse(dueDate + 'T00:00:00') - today0) / 86400000) : null;
  const daysByDistance = distanceLeft != null && perDay ? Math.round(distanceLeft / perDay) : null;
  let state: DueState = 'unknown';
  if (distanceLeft != null || daysLeft != null) {
    const overdue = (distanceLeft != null && distanceLeft <= 0) || (daysLeft != null && daysLeft <= 0);
    const soonDistance = distanceLeft != null && m.everyDistance != null && distanceLeft <= Math.max(m.everyDistance * 0.1, 300);
    const soonDays = (daysLeft != null && daysLeft <= 30) || (daysByDistance != null && daysByDistance <= 21);
    state = overdue ? 'overdue' : soonDistance || soonDays ? 'soon' : 'ok';
  }
  return { state, dueOdometer, dueDate, distanceLeft, daysLeft, daysByDistance };
}

const ORDER: Record<DueState, number> = { overdue: 0, soon: 1, unknown: 2, ok: 3 };

/** Los mantenimientos con su estado, lo más urgente primero. */
export function maintenanceStatus(log: CarLog, now = new Date()): { m: Maintenance; due: DueInfo }[] {
  const odo = currentOdometer(log);
  const perDay = distancePerDay(log);
  return log.maintenance.map((m) => ({ m, due: dueInfo(m, odo, perDay, now) }))
    .sort((a, b) => ORDER[a.due.state] - ORDER[b.due.state] || urgency(a.due) - urgency(b.due));
}

const urgency = (d: DueInfo) => Math.min(d.daysLeft ?? Infinity, d.daysByDistance ?? (d.distanceLeft != null ? d.distanceLeft / 50 : Infinity));

/** Anotar que se hizo: pasa a ser la última vez (la anterior va a la historia). */
export function markDone(m: Maintenance, when: Done): void {
  if (m.last) m.history.unshift(m.last);
  m.history = m.history.slice(0, 50);
  m.last = when;
}
