/**
 * Split engine — turns a total (in base-currency minor units) plus a chosen
 * method into a per-member "owed" allocation that ALWAYS sums exactly to the
 * total. Pure and fully unit-tested.
 */

import { allocateEqual, distribute, sumCents, type Cents } from './money';

export type SplitMethod = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ADJUSTMENT' | 'ITEMIZED';

export class SplitError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SplitError';
    this.code = code;
  }
}

/** A member's participation in a split. `value` meaning depends on the method. */
export interface SplitInput {
  memberId: string;
  /**
   * EQUAL:      ignored (use `included`)
   * EXACT:      exact owed amount in minor units
   * PERCENTAGE: percentage (0–100), may be fractional
   * SHARES:     positive weight
   * ADJUSTMENT: +/- adjustment in minor units
   */
  value?: number;
  included?: boolean;
}

export interface ItemizedItemInput {
  amount: Cents;
  /** Members sharing this line item equally. */
  memberIds: string[];
}

export interface SplitResultEntry {
  memberId: string;
  owedAmount: Cents;
  shareValue: number | null;
}

const EPSILON = 1e-6;

function includedMembers(entries: SplitInput[]): SplitInput[] {
  const inc = entries.filter((e) => e.included !== false);
  return inc.length > 0 ? inc : entries;
}

/**
 * Compute the per-member owed allocation for a non-itemized split.
 * `total` is in base-currency minor units and must be a non-negative integer.
 */
export function computeSplit(
  method: SplitMethod,
  total: Cents,
  entries: SplitInput[],
): SplitResultEntry[] {
  if (!Number.isInteger(total) || total < 0) {
    throw new SplitError('INVALID_TOTAL', 'Total must be a non-negative integer (minor units).');
  }
  if (method === 'ITEMIZED') {
    throw new SplitError('USE_ITEMIZED', 'Use computeItemizedSplit for itemized expenses.');
  }
  if (entries.length === 0) {
    throw new SplitError('NO_MEMBERS', 'A split needs at least one participant.');
  }

  switch (method) {
    case 'EQUAL': {
      const inc = includedMembers(entries);
      const amounts = allocateEqual(total, inc.length);
      return inc.map((e, i) => ({
        memberId: e.memberId,
        owedAmount: amounts[i]!,
        shareValue: null,
      }));
    }

    case 'EXACT': {
      const result = entries.map((e) => ({
        memberId: e.memberId,
        owedAmount: Math.round(e.value ?? 0),
        shareValue: Math.round(e.value ?? 0),
      }));
      const sum = sumCents(result.map((r) => r.owedAmount));
      if (sum !== total) {
        throw new SplitError(
          'EXACT_MISMATCH',
          `Exact amounts must sum to the total. Got ${sum}, expected ${total}.`,
        );
      }
      return result;
    }

    case 'PERCENTAGE': {
      const inc = includedMembers(entries);
      const percents = inc.map((e) => e.value ?? 0);
      if (percents.some((p) => p < 0)) {
        throw new SplitError('NEGATIVE_PERCENT', 'Percentages cannot be negative.');
      }
      const sum = percents.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > EPSILON) {
        throw new SplitError('PERCENT_SUM', `Percentages must sum to 100. Got ${sum}.`);
      }
      const amounts = distribute(total, percents);
      return inc.map((e, i) => ({
        memberId: e.memberId,
        owedAmount: amounts[i]!,
        shareValue: percents[i]!,
      }));
    }

    case 'SHARES': {
      const inc = includedMembers(entries);
      const shares = inc.map((e) => e.value ?? 0);
      if (shares.some((s) => s < 0)) {
        throw new SplitError('NEGATIVE_SHARE', 'Shares cannot be negative.');
      }
      if (shares.reduce((a, b) => a + b, 0) <= 0) {
        throw new SplitError('ZERO_SHARES', 'At least one share must be positive.');
      }
      const amounts = distribute(total, shares);
      return inc.map((e, i) => ({
        memberId: e.memberId,
        owedAmount: amounts[i]!,
        shareValue: shares[i]!,
      }));
    }

    case 'ADJUSTMENT': {
      const inc = includedMembers(entries);
      const adjustments = inc.map((e) => Math.round(e.value ?? 0));
      const adjustmentTotal = adjustments.reduce((a, b) => a + b, 0);
      const base = total - adjustmentTotal;
      const equalParts = allocateEqual(base, inc.length);
      return inc.map((e, i) => ({
        memberId: e.memberId,
        owedAmount: equalParts[i]! + adjustments[i]!,
        shareValue: adjustments[i]!,
      }));
    }

    default:
      throw new SplitError('UNKNOWN_METHOD', `Unknown split method: ${method as string}`);
  }
}

/**
 * Compute an itemized split. Each item is shared equally among its participants;
 * the per-member result is the sum of their item shares. The returned total
 * equals the sum of all item amounts.
 */
export function computeItemizedSplit(items: ItemizedItemInput[]): {
  total: Cents;
  entries: SplitResultEntry[];
} {
  const owed = new Map<string, Cents>();
  let total = 0;

  for (const item of items) {
    if (!Number.isInteger(item.amount) || item.amount < 0) {
      throw new SplitError('INVALID_ITEM', 'Item amounts must be non-negative integers.');
    }
    if (item.memberIds.length === 0) {
      throw new SplitError('ITEM_NO_MEMBERS', 'Each item needs at least one participant.');
    }
    total += item.amount;
    const shares = allocateEqual(item.amount, item.memberIds.length);
    item.memberIds.forEach((memberId, i) => {
      owed.set(memberId, (owed.get(memberId) ?? 0) + shares[i]!);
    });
  }

  const entries: SplitResultEntry[] = [...owed.entries()].map(([memberId, owedAmount]) => ({
    memberId,
    owedAmount,
    shareValue: null,
  }));

  return { total, entries };
}

/** Validate that a set of payer contributions sums exactly to the total. */
export function validatePayers(total: Cents, payers: { amount: Cents }[]): void {
  if (payers.length === 0) {
    throw new SplitError('NO_PAYERS', 'An expense needs at least one payer.');
  }
  const sum = sumCents(payers.map((p) => p.amount));
  if (sum !== total) {
    throw new SplitError(
      'PAYER_MISMATCH',
      `Payer amounts must sum to the total. Got ${sum}, expected ${total}.`,
    );
  }
}

/** Assert that a computed split sums exactly to the total (defensive guard). */
export function assertSplitSumsToTotal(total: Cents, entries: SplitResultEntry[]): void {
  const sum = sumCents(entries.map((e) => e.owedAmount));
  if (sum !== total) {
    throw new SplitError(
      'SPLIT_MISMATCH',
      `Split must sum to the total. Got ${sum}, expected ${total}.`,
    );
  }
}
