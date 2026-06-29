import { describe, expect, it } from 'vitest';
import { sumCents } from '@/lib/money';
import {
  SplitError,
  assertSplitSumsToTotal,
  computeItemizedSplit,
  computeSplit,
  validatePayers,
  type SplitInput,
} from '@/lib/split';

const members = (ids: string[]): SplitInput[] => ids.map((memberId) => ({ memberId }));

describe('computeSplit EQUAL', () => {
  it('sums exactly to the total', () => {
    const r = computeSplit('EQUAL', 1000, members(['a', 'b', 'c']));
    expect(sumCents(r.map((e) => e.owedAmount))).toBe(1000);
    expect(r.map((e) => e.owedAmount)).toEqual([334, 333, 333]);
  });

  it('only splits among included members', () => {
    const r = computeSplit('EQUAL', 900, [
      { memberId: 'a', included: true },
      { memberId: 'b', included: false },
      { memberId: 'c', included: true },
    ]);
    expect(r).toHaveLength(2);
    expect(sumCents(r.map((e) => e.owedAmount))).toBe(900);
  });
});

describe('computeSplit EXACT', () => {
  it('accepts amounts that sum to the total', () => {
    const r = computeSplit('EXACT', 1000, [
      { memberId: 'a', value: 600 },
      { memberId: 'b', value: 400 },
    ]);
    expect(r.map((e) => e.owedAmount)).toEqual([600, 400]);
  });
  it('rejects amounts that do not sum to the total', () => {
    expect(() =>
      computeSplit('EXACT', 1000, [
        { memberId: 'a', value: 600 },
        { memberId: 'b', value: 300 },
      ]),
    ).toThrow(SplitError);
  });
});

describe('computeSplit PERCENTAGE', () => {
  it('distributes by percentages summing to 100', () => {
    const r = computeSplit('PERCENTAGE', 1000, [
      { memberId: 'a', value: 33.33 },
      { memberId: 'b', value: 33.33 },
      { memberId: 'c', value: 33.34 },
    ]);
    expect(sumCents(r.map((e) => e.owedAmount))).toBe(1000);
  });
  it('rejects percentages not summing to 100', () => {
    expect(() =>
      computeSplit('PERCENTAGE', 1000, [
        { memberId: 'a', value: 50 },
        { memberId: 'b', value: 40 },
      ]),
    ).toThrow(SplitError);
  });
});

describe('computeSplit SHARES', () => {
  it('distributes by weights', () => {
    const r = computeSplit('SHARES', 1200, [
      { memberId: 'a', value: 1 },
      { memberId: 'b', value: 2 },
      { memberId: 'c', value: 3 },
    ]);
    expect(sumCents(r.map((e) => e.owedAmount))).toBe(1200);
    expect(r.map((e) => e.owedAmount)).toEqual([200, 400, 600]);
  });
});

describe('computeSplit ADJUSTMENT', () => {
  it('applies +/- adjustments and still sums to the total', () => {
    const r = computeSplit('ADJUSTMENT', 1000, [
      { memberId: 'a', value: 100 }, // a covers 1.00 extra
      { memberId: 'b', value: 0 },
      { memberId: 'c', value: -40 },
    ]);
    expect(sumCents(r.map((e) => e.owedAmount))).toBe(1000);
    // base = 1000 - 60 = 940 -> 314/313/313 + adjustments
    const byId = Object.fromEntries(r.map((e) => [e.memberId, e.owedAmount]));
    expect(byId.a! - byId.b!).toBe(100 + (314 - 313));
  });
});

describe('computeItemizedSplit', () => {
  it('sums item shares per member and equals the item total', () => {
    const { total, entries } = computeItemizedSplit([
      { amount: 1000, memberIds: ['a', 'b'] }, // 500 / 500
      { amount: 300, memberIds: ['a'] }, // 300
      { amount: 101, memberIds: ['a', 'b', 'c'] }, // 34/33/34? sums 101
    ]);
    expect(total).toBe(1401);
    expect(sumCents(entries.map((e) => e.owedAmount))).toBe(1401);
    const byId = Object.fromEntries(entries.map((e) => [e.memberId, e.owedAmount]));
    expect(byId.a).toBe(500 + 300 + 34);
  });
});

describe('validatePayers / assertSplitSumsToTotal', () => {
  it('accepts payers summing to total', () => {
    expect(() => validatePayers(1000, [{ amount: 700 }, { amount: 300 }])).not.toThrow();
  });
  it('rejects payers not summing to total', () => {
    expect(() => validatePayers(1000, [{ amount: 700 }])).toThrow(SplitError);
  });
  it('guards split totals', () => {
    expect(() =>
      assertSplitSumsToTotal(1000, [{ memberId: 'a', owedAmount: 999, shareValue: null }]),
    ).toThrow(SplitError);
  });
});
