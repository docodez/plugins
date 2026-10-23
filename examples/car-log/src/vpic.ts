// Makes and models by year, and VIN decoding: the public NHTSA database (vPIC, US: free, no account, allows requests from
// any page). It's only a typing aid: the car's name can always be entered by hand, and nothing breaks without internet.

const API = 'https://vpic.nhtsa.dot.gov/api/vehicles/';

/** The most common makes (to suggest without a request: the full vPIC list has thousands). */
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

/** A make's models for a year (empty if unknown or offline). */
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

/** What a VIN (17 characters) decodes to, or null if it couldn't be read. */
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
