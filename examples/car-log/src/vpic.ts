// Marcas y modelos por año, y leer un VIN: la base pública de la NHTSA (vPIC, de EE. UU.: gratis, sin cuenta, permite
// pedidos desde cualquier página). Es solo una ayuda para escribir: el nombre del carro siempre se puede poner a mano, y
// sin internet no pasa nada.

const API = 'https://vpic.nhtsa.dot.gov/api/vehicles/';

/** Las marcas más comunes (para sugerir sin pedir nada: la lista completa de vPIC tiene miles). */
export const MAKES = [
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick', 'BYD', 'Cadillac', 'Chery', 'Chevrolet', 'Chrysler',
  'Citroën', 'Cupra', 'Dacia', 'Daewoo', 'Daihatsu', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Genesis', 'Geely', 'GMC', 'Great Wall',
  'Honda', 'Hummer', 'Hyundai', 'Infiniti', 'Isuzu', 'Jaguar', 'Jeep', 'JAC', 'Kia', 'Lada', 'Lamborghini', 'Land Rover', 'Lexus',
  'Lincoln', 'Lotus', 'Lucid', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Opel',
  'Peugeot', 'Polestar', 'Pontiac', 'Porsche', 'Ram', 'Renault', 'Rivian', 'Rolls-Royce', 'Saab', 'Seat', 'Škoda', 'Smart',
  'SsangYong', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
];

const cache = new Map<string, string[]>();

async function get(path: string, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const r = await fetch(API + path + (path.includes('?') ? '&' : '?') + 'format=json', { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const data = (await r.json()) as { Results?: Record<string, unknown>[] };
  return data.Results ?? [];
}

/** Los modelos de una marca en un año (vacío si no se sabe o no hay conexión). */
export async function modelsFor(make: string, year: string, signal?: AbortSignal): Promise<string[]> {
  const y = /^\d{4}$/.test(year.trim()) ? year.trim() : '';
  if (!make.trim()) return [];
  const key = make.trim().toLowerCase() + '|' + y;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const path = y ? `GetModelsForMakeYear/make/${encodeURIComponent(make.trim())}/modelyear/${y}`
      : `GetModelsForMake/${encodeURIComponent(make.trim())}`;
    const names = [...new Set((await get(path, signal)).map((r) => String(r.Model_Name ?? '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
    cache.set(key, names);
    return names;
  } catch {
    return [];
  }
}

export interface VinInfo { make: string; model: string; year: string; trim: string; fuelType: string; engine: string; body: string }

/** Lo que dice un VIN (17 caracteres), o null si no se pudo leer. */
export async function decodeVin(vin: string): Promise<VinInfo | null> {
  const v = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return null;
  const [r] = await get(`DecodeVinValues/${v}`);
  if (!r) return null;
  const s = (k: string) => String(r[k] ?? '').trim();
  const make = s('Make');
  if (!make) return null;
  const title = (x: string) => x.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  const liters = s('DisplacementL') ? `${Number(s('DisplacementL')).toFixed(1)} L` : '';
  const cyl = s('EngineCylinders') ? `${s('EngineCylinders')} cyl` : '';
  return {
    make: title(make), model: s('Model'), year: s('ModelYear'), trim: s('Trim'),
    fuelType: s('FuelTypePrimary'), engine: [liters, cyl].filter(Boolean).join(' · '), body: s('BodyClass'),
  };
}
