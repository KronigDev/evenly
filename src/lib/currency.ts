/**
 * Currency catalogue + conversion. Rates are stored relative to a single pivot
 * (USD): for each currency we keep "how many units of X equal 1 USD". The app
 * ships with a seeded rate table and works fully offline; an optional provider
 * can refresh it (see lib/exchange-rates.ts).
 */

import { fromMinorUnits, roundCents, toMinorUnits, type Cents } from './money';

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
}

/** Supported currencies (display + selection). Add more freely. */
export const CURRENCIES: CurrencyMeta[] = [
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_CODES.includes(code.toUpperCase());
}

export function currencyMeta(code: string): CurrencyMeta | undefined {
  return CURRENCIES.find((c) => c.code === code.toUpperCase());
}

/**
 * Seed rates as units-per-USD (approximate, mid-2024). Used to populate the
 * ExchangeRate table and as a built-in fallback so conversion never throws.
 */
export const SEED_RATES_PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.9,
  JPY: 157,
  CAD: 1.37,
  AUD: 1.51,
  NZD: 1.63,
  CNY: 7.25,
  INR: 83.4,
  SEK: 10.7,
  NOK: 10.8,
  DKK: 6.86,
  PLN: 3.97,
  CZK: 23.2,
  HUF: 363,
  RON: 4.58,
  BGN: 1.8,
  TRY: 32.5,
  ZAR: 18.3,
  BRL: 5.43,
  MXN: 18.4,
  SGD: 1.35,
  HKD: 7.81,
  AED: 3.67,
  THB: 36.7,
  IDR: 16250,
  KRW: 1380,
  PHP: 58.3,
  ILS: 3.74,
};

export type RateMap = Record<string, number>;

/** Units of `code` per 1 USD; falls back to the built-in seed rates. */
function unitsPerUsd(code: string, rates: RateMap): number {
  const c = code.toUpperCase();
  return rates[c] ?? SEED_RATES_PER_USD[c] ?? 1;
}

/**
 * Convert an integer amount in `from` minor units to `to` minor units, going
 * via the USD pivot. Returns an integer (rounded to the target's minor unit).
 */
export function convertMinor(amount: Cents, from: string, to: string, rates: RateMap): Cents {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const major = fromMinorUnits(amount, from);
  const usd = major / unitsPerUsd(from, rates);
  const target = usd * unitsPerUsd(to, rates);
  return roundCents(toMinorUnits(target, to));
}

/** The conversion factor (major units of `to` per 1 major unit of `from`). */
export function conversionRate(from: string, to: string, rates: RateMap): number {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  return unitsPerUsd(to, rates) / unitsPerUsd(from, rates);
}
