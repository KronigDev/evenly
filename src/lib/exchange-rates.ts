import { SEED_RATES_PER_USD, type RateMap } from '@/lib/currency';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Current USD-pivot rate map. Reads the seeded ExchangeRate table and merges
 * the built-in fallback so conversion never throws on an unknown currency.
 */
export async function getRateMap(): Promise<RateMap> {
  const rows = await prisma.exchangeRate.findMany({ where: { base: 'USD' } });
  const map: RateMap = { ...SEED_RATES_PER_USD, USD: 1 };
  for (const row of rows) map[row.quote] = Number(row.rate);
  return map;
}

/**
 * Optionally refresh rates from a configured provider. Expects JSON shaped
 * `{ rates: { EUR: 0.92, ... } }` with USD as the implicit base. Returns the
 * number of rates written, or 0 when no provider is configured.
 */
export async function refreshRatesFromApi(): Promise<number> {
  if (!env.EXCHANGE_RATE_API_URL) return 0;
  const res = await fetch(env.EXCHANGE_RATE_API_URL, {
    headers: env.EXCHANGE_RATE_API_KEY
      ? { Authorization: `Bearer ${env.EXCHANGE_RATE_API_KEY}` }
      : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Exchange rate provider returned ${res.status}`);
  const json = (await res.json()) as { rates?: Record<string, number> };
  const rates = json.rates ?? {};
  const entries = Object.entries(rates).filter(([, rate]) => Number.isFinite(rate) && rate > 0);
  if (entries.length === 0) return 0;

  await prisma.$transaction(
    entries.map(([quote, rate]) =>
      prisma.exchangeRate.upsert({
        where: { base_quote: { base: 'USD', quote } },
        update: { rate: String(rate), asOf: new Date() },
        create: { base: 'USD', quote, rate: String(rate) },
      }),
    ),
  );
  return entries.length;
}
