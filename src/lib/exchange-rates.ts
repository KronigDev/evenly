import { SEED_RATES_PER_USD, type RateMap } from '@/lib/currency';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

const RATES_TTL_MS = 24 * 60 * 60 * 1000; // provider updates daily
const RETRY_COOLDOWN_MS = 15 * 60 * 1000; // back off when the provider is unreachable
let nextAttemptAt = 0;

/**
 * Current USD-pivot rate map. Reads the stored ExchangeRate table and merges
 * the built-in fallback so conversion never throws on an unknown currency.
 * Kicks off a background refresh from the configured provider when the stored
 * rates are older than a day.
 */
export async function getRateMap(): Promise<RateMap> {
  void maybeRefreshRates();
  const rows = await prisma.exchangeRate.findMany({ where: { base: 'USD' } });
  const map: RateMap = { ...SEED_RATES_PER_USD, USD: 1 };
  for (const row of rows) map[row.quote] = Number(row.rate);
  return map;
}

async function maybeRefreshRates(): Promise<void> {
  if (!env.EXCHANGE_RATE_API_URL) return;
  const now = Date.now();
  if (now < nextAttemptAt) return;
  nextAttemptAt = now + RETRY_COOLDOWN_MS;
  try {
    const newest = await prisma.exchangeRate.findFirst({
      where: { base: 'USD' },
      orderBy: { asOf: 'desc' },
      select: { asOf: true },
    });
    if (newest && now - newest.asOf.getTime() < RATES_TTL_MS) {
      nextAttemptAt = newest.asOf.getTime() + RATES_TTL_MS;
      return;
    }
    await refreshRatesFromApi();
  } catch {
    // Offline or provider down — stored/bundled rates keep working.
  }
}

/**
 * Refresh rates from the configured provider (ExchangeRate-API's open endpoint
 * by default). Expects JSON shaped `{ rates: { EUR: 0.92, ... } }` with USD as
 * the implicit base. Returns the number of rates written, or 0 when the
 * provider is disabled via EXCHANGE_RATE_API_URL="off".
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
