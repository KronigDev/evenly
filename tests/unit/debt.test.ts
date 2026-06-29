import { describe, expect, it } from 'vitest';
import {
  computeNetBalances,
  computePairwiseDebts,
  simplifyDebts,
  summarizeForMember,
  type ExpenseFlow,
  type SettlementFlow,
} from '@/lib/debt';
import { distribute } from '@/lib/money';

describe('computeNetBalances', () => {
  it('nets paid minus owed, and sums to zero', () => {
    // A pays 30, split equally among A, B, C (10 each).
    const expenses: ExpenseFlow[] = [
      {
        payers: [{ memberId: 'A', amount: 3000 }],
        splits: [
          { memberId: 'A', amount: 1000 },
          { memberId: 'B', amount: 1000 },
          { memberId: 'C', amount: 1000 },
        ],
      },
    ];
    const net = computeNetBalances(['A', 'B', 'C'], expenses, []);
    expect(net.get('A')).toBe(2000);
    expect(net.get('B')).toBe(-1000);
    expect(net.get('C')).toBe(-1000);
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('applies settlements', () => {
    const expenses: ExpenseFlow[] = [
      {
        payers: [{ memberId: 'A', amount: 1000 }],
        splits: [
          { memberId: 'A', amount: 500 },
          { memberId: 'B', amount: 500 },
        ],
      },
    ];
    const settlements: SettlementFlow[] = [{ fromMemberId: 'B', toMemberId: 'A', amount: 500 }];
    const net = computeNetBalances(['A', 'B'], expenses, settlements);
    expect(net.get('A')).toBe(0);
    expect(net.get('B')).toBe(0);
  });
});

describe('simplifyDebts', () => {
  it('clears a simple chain with one transfer', () => {
    const net = new Map([
      ['A', 2000],
      ['B', -1000],
      ['C', -1000],
    ]);
    const transfers = simplifyDebts(net);
    expect(transfers).toHaveLength(2);
    const total = transfers.reduce((a, t) => a + t.amount, 0);
    expect(total).toBe(2000);
    for (const t of transfers) expect(t.toMemberId).toBe('A');
  });

  it('uses at most n-1 transfers and reconciles each member', () => {
    const net = new Map([
      ['A', 500],
      ['B', 500],
      ['C', -700],
      ['D', -300],
    ]);
    const transfers = simplifyDebts(net);
    const nonZero = [...net.values()].filter((v) => v !== 0).length;
    expect(transfers.length).toBeLessThanOrEqual(nonZero - 1);
    for (const [id, balance] of net) {
      expect(summarizeForMember(id, transfers).net).toBe(balance);
    }
  });
});

// Deterministic, seeded RNG for reproducible property tests.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSubset<T>(arr: T[], rng: () => number): T[] {
  const out = arr.filter(() => rng() > 0.4);
  return out.length > 0 ? out : [arr[Math.floor(rng() * arr.length)]!];
}

describe('computePairwiseDebts reconciliation (property test)', () => {
  it('pairwise net per member always equals the net balance', () => {
    const memberIds = ['m0', 'm1', 'm2', 'm3', 'm4'];
    for (let seed = 1; seed <= 200; seed++) {
      const rng = mulberry32(seed);
      const expenses: ExpenseFlow[] = [];
      const settlements: SettlementFlow[] = [];

      const expenseCount = 1 + Math.floor(rng() * 6);
      for (let e = 0; e < expenseCount; e++) {
        const total = 100 + Math.floor(rng() * 20000);
        const payerIds = randomSubset(memberIds, rng);
        const splitIds = randomSubset(memberIds, rng);
        const payAmounts = distribute(
          total,
          payerIds.map(() => 1 + rng()),
        );
        const splitAmounts = distribute(
          total,
          splitIds.map(() => 1 + rng()),
        );
        expenses.push({
          payers: payerIds.map((memberId, i) => ({ memberId, amount: payAmounts[i]! })),
          splits: splitIds.map((memberId, i) => ({ memberId, amount: splitAmounts[i]! })),
        });
      }

      const settlementCount = Math.floor(rng() * 3);
      for (let s = 0; s < settlementCount; s++) {
        const from = memberIds[Math.floor(rng() * memberIds.length)]!;
        let to = memberIds[Math.floor(rng() * memberIds.length)]!;
        if (to === from) to = memberIds[(memberIds.indexOf(from) + 1) % memberIds.length]!;
        settlements.push({
          fromMemberId: from,
          toMemberId: to,
          amount: 1 + Math.floor(rng() * 500),
        });
      }

      const net = computeNetBalances(memberIds, expenses, settlements);
      const pairwise = computePairwiseDebts(expenses, settlements);

      for (const id of memberIds) {
        expect(summarizeForMember(id, pairwise).net, `seed ${seed} member ${id}`).toBe(net.get(id));
      }
      // No self-transfers, all positive amounts.
      for (const t of pairwise) {
        expect(t.fromMemberId).not.toBe(t.toMemberId);
        expect(t.amount).toBeGreaterThan(0);
      }
    }
  });
});
