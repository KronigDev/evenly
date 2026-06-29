/**
 * Balance & debt engine — computes per-member net balances, exact pairwise
 * "who owes whom" debts, and a simplified (minimum-transfer) settlement plan.
 * All amounts are integer minor units in the group's base currency.
 */

import type { Cents } from './money';

export interface ExpenseFlow {
  payers: { memberId: string; amount: Cents }[];
  splits: { memberId: string; amount: Cents }[];
}

export interface SettlementFlow {
  fromMemberId: string;
  toMemberId: string;
  amount: Cents;
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: Cents;
}

/**
 * Net balance per member: positive = they are owed money (creditor),
 * negative = they owe money (debtor). The sum across all members is always 0.
 */
export function computeNetBalances(
  memberIds: string[],
  expenses: ExpenseFlow[],
  settlements: SettlementFlow[],
): Map<string, Cents> {
  const net = new Map<string, Cents>();
  for (const id of memberIds) net.set(id, 0);
  const bump = (id: string, delta: Cents) => net.set(id, (net.get(id) ?? 0) + delta);

  for (const e of expenses) {
    for (const p of e.payers) bump(p.memberId, p.amount); // paid on behalf of the group
    for (const s of e.splits) bump(s.memberId, -s.amount); // consumed / owes
  }
  // A settlement (from -> to) means `from` paid `to`, reducing `from`'s debt.
  for (const s of settlements) {
    bump(s.fromMemberId, s.amount);
    bump(s.toMemberId, -s.amount);
  }
  return net;
}

interface PairMap {
  add: (from: string, to: string, amount: Cents) => void;
  net: () => Transfer[];
}

function makePairMap(): PairMap {
  const map = new Map<string, Map<string, Cents>>();
  const add = (from: string, to: string, amount: Cents) => {
    if (amount === 0 || from === to) return;
    let inner = map.get(from);
    if (!inner) {
      inner = new Map();
      map.set(from, inner);
    }
    inner.set(to, (inner.get(to) ?? 0) + amount);
  };
  const net = (): Transfer[] => {
    const seen = new Set<string>();
    const out: Transfer[] = [];
    for (const [from, inner] of map) {
      for (const to of inner.keys()) {
        const key = [from, to].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const forward = inner.get(to) ?? 0;
        const backward = map.get(to)?.get(from) ?? 0;
        const diff = forward - backward;
        if (diff > 0) out.push({ fromMemberId: from, toMemberId: to, amount: diff });
        else if (diff < 0) out.push({ fromMemberId: to, toMemberId: from, amount: -diff });
      }
    }
    return out;
  };
  return { add, net };
}

/**
 * Exact pairwise debts (the "non-simplified" view). For each expense, debtors'
 * deficits are matched to creditors' surpluses with a deterministic greedy
 * water-fill, which preserves every member's net balance exactly (no rounding
 * drift). Settlements then net against the corresponding pair.
 */
export function computePairwiseDebts(
  expenses: ExpenseFlow[],
  settlements: SettlementFlow[],
): Transfer[] {
  const pairs = makePairMap();

  for (const e of expenses) {
    const paid = new Map<string, Cents>();
    const owed = new Map<string, Cents>();
    for (const p of e.payers) paid.set(p.memberId, (paid.get(p.memberId) ?? 0) + p.amount);
    for (const s of e.splits) owed.set(s.memberId, (owed.get(s.memberId) ?? 0) + s.amount);

    const everyone = new Set<string>([...paid.keys(), ...owed.keys()]);
    const creditors: { id: string; remaining: Cents }[] = [];
    const debtors: { id: string; remaining: Cents }[] = [];
    for (const id of everyone) {
      const diff = (paid.get(id) ?? 0) - (owed.get(id) ?? 0);
      if (diff > 0) creditors.push({ id, remaining: diff });
      else if (diff < 0) debtors.push({ id, remaining: -diff });
    }
    // Deterministic order for stable output.
    creditors.sort((a, b) => (a.id < b.id ? -1 : 1));
    debtors.sort((a, b) => (a.id < b.id ? -1 : 1));

    let ci = 0;
    let di = 0;
    while (di < debtors.length && ci < creditors.length) {
      const d = debtors[di]!;
      const c = creditors[ci]!;
      const amount = Math.min(d.remaining, c.remaining);
      pairs.add(d.id, c.id, amount);
      d.remaining -= amount;
      c.remaining -= amount;
      if (d.remaining === 0) di += 1;
      if (c.remaining === 0) ci += 1;
    }
  }

  // Settling a debt (from -> to) is the reverse-direction flow against the pair.
  for (const s of settlements) pairs.add(s.toMemberId, s.fromMemberId, s.amount);

  return pairs
    .net()
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (a.fromMemberId < b.fromMemberId ? -1 : 1) ||
        (a.toMemberId < b.toMemberId ? -1 : 1),
    );
}

/**
 * Simplified settlement plan: the minimum-ish set of transfers that clears all
 * balances, computed greedily by repeatedly matching the largest creditor with
 * the largest debtor. Amounts reconcile exactly.
 */
export function simplifyDebts(netBalances: Map<string, Cents>): Transfer[] {
  const creditors: { id: string; amount: Cents }[] = [];
  const debtors: { id: string; amount: Cents }[] = [];
  for (const [id, balance] of netBalances) {
    if (balance > 0) creditors.push({ id, amount: balance });
    else if (balance < 0) debtors.push({ id, amount: -balance });
  }

  // Largest first; tie-break on id for deterministic output.
  creditors.sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));
  debtors.sort((a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]!;
    const d = debtors[di]!;
    const amount = Math.min(c.amount, d.amount);
    if (amount > 0) {
      transfers.push({ fromMemberId: d.id, toMemberId: c.id, amount });
    }
    c.amount -= amount;
    d.amount -= amount;
    if (c.amount === 0) ci += 1;
    if (d.amount === 0) di += 1;
  }
  return transfers;
}

/**
 * Summarize a member's position: how much they owe in total and are owed in
 * total, derived from a list of (signed) pairwise transfers for the group.
 */
export function summarizeForMember(
  memberId: string,
  transfers: Transfer[],
): { owes: Cents; owed: Cents; net: Cents } {
  let owes = 0;
  let owed = 0;
  for (const t of transfers) {
    if (t.fromMemberId === memberId) owes += t.amount;
    if (t.toMemberId === memberId) owed += t.amount;
  }
  return { owes, owed, net: owed - owes };
}
