import { describe, expect, it } from 'vitest';
import {
  allocateEqual,
  currencyDecimals,
  distribute,
  formatMoney,
  fromMinorUnits,
  parseMoneyInput,
  proportionalConvert,
  sumCents,
  toMinorUnits,
} from '@/lib/money';

describe('currency decimals', () => {
  it('knows zero-, two- and three-decimal currencies', () => {
    expect(currencyDecimals('EUR')).toBe(2);
    expect(currencyDecimals('usd')).toBe(2);
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KWD')).toBe(3);
  });
});

describe('minor unit conversion', () => {
  it('round-trips amounts', () => {
    expect(toMinorUnits(12.34, 'EUR')).toBe(1234);
    expect(fromMinorUnits(1234, 'EUR')).toBeCloseTo(12.34);
    expect(toMinorUnits(1000, 'JPY')).toBe(1000);
    expect(toMinorUnits(1.5, 'KWD')).toBe(1500);
  });

  it('avoids binary float drift', () => {
    expect(toMinorUnits(0.1 + 0.2, 'EUR')).toBe(30);
    expect(toMinorUnits(19.99, 'EUR')).toBe(1999);
  });
});

describe('distribute (largest remainder)', () => {
  it('always sums exactly to the total', () => {
    for (const total of [0, 1, 2, 7, 100, 101, 1000, 9999, 123_456]) {
      for (const n of [1, 2, 3, 4, 7]) {
        const parts = allocateEqual(total, n);
        expect(parts).toHaveLength(n);
        expect(sumCents(parts)).toBe(total);
      }
    }
  });

  it('splits 100 across 3 as 34/33/33', () => {
    expect(distribute(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('respects weights', () => {
    expect(sumCents(distribute(1000, [1, 2, 7]))).toBe(1000);
    expect(distribute(1000, [1, 1])).toEqual([500, 500]);
  });

  it('handles negative totals (refunds)', () => {
    const parts = distribute(-100, [1, 1, 1]);
    expect(sumCents(parts)).toBe(-100);
  });

  it('falls back to equal when weights are all zero', () => {
    expect(sumCents(distribute(10, [0, 0, 0]))).toBe(10);
  });
});

describe('parseMoneyInput', () => {
  it('parses dot decimals', () => {
    expect(parseMoneyInput('12.34', 'EUR')).toBe(1234);
    expect(parseMoneyInput('1,234.56', 'EUR')).toBe(123456);
  });
  it('parses comma decimals', () => {
    expect(parseMoneyInput('12,34', 'EUR')).toBe(1234);
    expect(parseMoneyInput('1.234,56', 'EUR')).toBe(123456);
  });
  it('parses integers and currency symbols', () => {
    expect(parseMoneyInput('€ 50', 'EUR')).toBe(5000);
    expect(parseMoneyInput('1000', 'JPY')).toBe(1000);
  });
  it('returns null for garbage', () => {
    expect(parseMoneyInput('abc', 'EUR')).toBeNull();
    expect(parseMoneyInput('', 'EUR')).toBeNull();
  });
});

describe('proportionalConvert', () => {
  it('rescales to the target total exactly', () => {
    const out = proportionalConvert([5000, 5000], 10000, 10870); // EUR->USD
    expect(sumCents(out)).toBe(10870);
  });

  it('is identity when totals match', () => {
    expect(proportionalConvert([300, 400, 333], 1033, 1033)).toEqual([300, 400, 333]);
  });

  it('handles negative values (adjustment splits) while staying exact', () => {
    const out = proportionalConvert([1500, -200, 700], 2000, 2400);
    expect(sumCents(out)).toBe(2400);
    expect(out[1]!).toBeLessThan(0);
  });

  it('returns zeros for a zero source total', () => {
    expect(proportionalConvert([1, 2, 3], 0, 500)).toEqual([0, 0, 0]);
  });
});

describe('formatMoney', () => {
  it('formats with currency symbol', () => {
    expect(formatMoney(1234, 'EUR', 'en')).toContain('12.34');
    expect(formatMoney(1000, 'JPY', 'en')).toContain('1,000');
  });
});
