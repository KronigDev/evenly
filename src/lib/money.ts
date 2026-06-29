/**
 * Money utilities — everything is stored and computed in INTEGER minor units
 * (cents). No floating-point money math ever leaves this module: amounts are
 * apportioned with the largest-remainder method so a split always sums EXACTLY
 * to the total, to the cent.
 */

export type Cents = number;

// Currencies that do not use 2 decimal places.
const ZERO_DECIMAL = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Number of decimal places a currency uses (2 for most, 0 for JPY, 3 for KWD…). */
export function currencyDecimals(currency: string): number {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

/** 10^decimals for a currency (the minor-unit factor). */
export function minorUnitFactor(currency: string): number {
  return 10 ** currencyDecimals(currency);
}

/** Convert a decimal amount (e.g. 12.34) into integer minor units (1234). */
export function toMinorUnits(amount: number, currency: string): Cents {
  return Math.round(amount * minorUnitFactor(currency));
}

/** Convert integer minor units (1234) back to a decimal amount (12.34). */
export function fromMinorUnits(cents: Cents, currency: string): number {
  return cents / minorUnitFactor(currency);
}

/**
 * Parse a user-entered money string into integer minor units. Handles both
 * "1,234.56" and "1.234,56" conventions and bare integers. Returns null when
 * the input cannot be parsed as a number.
 */
export function parseMoneyInput(input: string, currency: string): Cents | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/\s/g, '');
  if (s === '') return null;

  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '').replace(/^-/, '');
  // Strip everything except digits, comma and dot.
  s = s.replace(/[^\d.,]/g, '');
  if (s === '') return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = s;
  } else if (lastComma > lastDot) {
    // comma is the decimal separator -> dots are thousands separators
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    // dot is the decimal separator -> commas are thousands separators
    normalized = s.replace(/,/g, '');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = toMinorUnits(value, currency);
  return neg ? -cents : cents;
}

/** Format integer minor units as a localized currency string. */
export function formatMoney(cents: Cents, currency: string, locale = 'en'): string {
  const decimals = currencyDecimals(currency);
  const value = fromMinorUnits(cents, currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Unknown ISO code — fall back to a plain number + code.
    return `${value.toFixed(decimals)} ${currency.toUpperCase()}`;
  }
}

/** Format the numeric part only (no currency symbol), for inputs. */
export function formatAmount(cents: Cents, currency: string, locale = 'en'): string {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  }).format(fromMinorUnits(cents, currency));
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Apportion `total` minor units across `weights` using the largest-remainder
 * method. The returned array sums EXACTLY to `total`. Works for negative totals.
 * Zero/empty weights fall back to an equal split.
 */
export function distribute(total: Cents, weights: number[]): Cents[] {
  const n = weights.length;
  if (n === 0) return [];
  if (total < 0) return distribute(-total, weights).map((c) => -c);

  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const totalWeight = safeWeights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    // No usable weights — split as evenly as possible.
    return distribute(total, new Array(n).fill(1));
  }

  const raw = safeWeights.map((w) => (total * w) / totalWeight);
  const floors = raw.map((r) => Math.floor(r));
  const used = floors.reduce((a, b) => a + b, 0);
  let remainder = total - used;

  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floors.slice();
  let k = 0;
  while (remainder > 0) {
    const idx = order[k % n]!.i;
    result[idx] = (result[idx] ?? 0) + 1;
    remainder -= 1;
    k += 1;
  }
  return result;
}

/** Split `total` minor units as evenly as possible across `count` shares. */
export function allocateEqual(total: Cents, count: number): Cents[] {
  if (count <= 0) return [];
  return distribute(total, new Array(count).fill(1));
}

/** Round half-up to the nearest cent — used after currency conversion. */
export function roundCents(value: number): Cents {
  return Math.round(value);
}

/**
 * Rescale a set of integer amounts that sum to `fromTotal` so they sum EXACTLY
 * to `toTotal`, preserving proportions. Unlike `distribute`, this correctly
 * handles negative values (e.g. +/- adjustment splits). Used to convert
 * per-member entry-currency amounts into base-currency minor units.
 */
export function proportionalConvert(values: Cents[], fromTotal: Cents, toTotal: Cents): Cents[] {
  if (values.length === 0) return [];
  if (fromTotal === 0) return values.map(() => 0);

  const raw = values.map((v) => (v * toTotal) / fromTotal);
  const rounded = raw.map((r) => Math.round(r));
  let diff = toTotal - rounded.reduce((a, b) => a + b, 0);

  // Nudge by the largest rounding residuals until the sum is exact.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.round(r) }))
    .sort((a, b) => Math.abs(b.frac) - Math.abs(a.frac) || a.i - b.i);
  let k = 0;
  while (diff !== 0 && order.length > 0) {
    const idx = order[k % order.length]!.i;
    rounded[idx] = (rounded[idx] ?? 0) + (diff > 0 ? 1 : -1);
    diff += diff > 0 ? -1 : 1;
    k += 1;
  }
  return rounded;
}
