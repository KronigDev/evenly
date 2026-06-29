import { describe, expect, it } from 'vitest';
import {
  CURRENCY_CODES,
  conversionRate,
  convertMinor,
  isSupportedCurrency,
  SEED_RATES_PER_USD,
} from '@/lib/currency';

const rates = SEED_RATES_PER_USD;

describe('currency catalogue', () => {
  it('lists common currencies', () => {
    expect(CURRENCY_CODES).toContain('EUR');
    expect(CURRENCY_CODES).toContain('USD');
    expect(isSupportedCurrency('eur')).toBe(true);
    expect(isSupportedCurrency('xxx')).toBe(false);
  });
});

describe('convertMinor', () => {
  it('is identity for the same currency', () => {
    expect(convertMinor(12345, 'EUR', 'EUR', rates)).toBe(12345);
  });

  it('converts EUR -> USD via the USD pivot', () => {
    // 100.00 EUR -> 100 / 0.92 = 108.6957 USD -> 10870 minor units
    expect(convertMinor(10000, 'EUR', 'USD', rates)).toBe(10870);
  });

  it('handles zero-decimal target currencies', () => {
    // 100.00 EUR -> 108.6957 USD -> * 157 = 17065 JPY (0 decimals)
    expect(convertMinor(10000, 'EUR', 'JPY', rates)).toBe(17065);
  });

  it('round-trips within a couple of cents', () => {
    const usd = convertMinor(10000, 'EUR', 'USD', rates);
    const back = convertMinor(usd, 'USD', 'EUR', rates);
    expect(Math.abs(back - 10000)).toBeLessThanOrEqual(2);
  });
});

describe('conversionRate', () => {
  it('returns the major-unit factor', () => {
    expect(conversionRate('EUR', 'EUR', rates)).toBe(1);
    expect(conversionRate('EUR', 'USD', rates)).toBeCloseTo(1 / 0.92, 4);
  });
});
