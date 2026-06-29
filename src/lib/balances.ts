import {
  computeNetBalances,
  computePairwiseDebts,
  simplifyDebts,
  summarizeForMember,
  type ExpenseFlow,
  type SettlementFlow,
  type Transfer,
} from '@/lib/debt';
import { prisma } from '@/lib/db';

export interface GroupBalances {
  memberIds: string[];
  net: Map<string, number>;
  pairwise: Transfer[];
  simplified: Transfer[];
}

/** Compute all balance views for a group from its expenses + settlements. */
export async function getGroupBalances(groupId: string): Promise<GroupBalances> {
  const [members, expenses, settlements] = await Promise.all([
    prisma.groupMember.findMany({ where: { groupId }, select: { id: true } }),
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: {
        payers: { select: { memberId: true, paidAmount: true } },
        splits: { select: { memberId: true, owedAmount: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: { fromMemberId: true, toMemberId: true, amount: true },
    }),
  ]);

  const memberIds = members.map((m) => m.id);
  const expenseFlows: ExpenseFlow[] = expenses.map((e) => ({
    payers: e.payers.map((p) => ({ memberId: p.memberId, amount: p.paidAmount })),
    splits: e.splits.map((s) => ({ memberId: s.memberId, amount: s.owedAmount })),
  }));
  const settlementFlows: SettlementFlow[] = settlements.map((s) => ({
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amount: s.amount,
  }));

  const net = computeNetBalances(memberIds, expenseFlows, settlementFlows);
  return {
    memberIds,
    net,
    pairwise: computePairwiseDebts(expenseFlows, settlementFlows),
    simplified: simplifyDebts(net),
  };
}

/** The signed-in member's net position in a group (+ owed to them, - they owe). */
export function memberNet(balances: GroupBalances, memberId: string): number {
  return balances.net.get(memberId) ?? 0;
}

export { summarizeForMember };
