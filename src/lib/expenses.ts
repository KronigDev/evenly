import { addDays, addMonths, addWeeks } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { recordActivity, notifyUsers, groupMemberUserIds } from '@/lib/activity';
import { conversionRate, convertMinor, type RateMap } from '@/lib/currency';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/http';
import { proportionalConvert, sumCents } from '@/lib/money';
import {
  assertSplitSumsToTotal,
  computeItemizedSplit,
  computeSplit,
  SplitError,
  validatePayers,
} from '@/lib/split';
import type { CreateExpenseInput } from '@/lib/validation/expense';

export const expenseInclude = {
  payers: true,
  splits: true,
  items: { include: { splits: true } },
  attachments: true,
  _count: { select: { comments: true } },
} satisfies Prisma.ExpenseInclude;

export function getExpenseFull(id: string) {
  return prisma.expense.findUnique({ where: { id }, include: expenseInclude });
}

interface BuiltRows {
  entryTotal: number;
  amountBase: number;
  exchangeRate: number;
  payers: { memberId: string; paidAmount: number }[];
  splits: { memberId: string; owedAmount: number; shareValue: number | null }[];
  items: {
    description: string;
    amount: number;
    splits: { memberId: string; owedAmount: number }[];
  }[];
}

/** Convert a validated expense input into exact base-currency rows. */
function buildRows(input: CreateExpenseInput, baseCurrency: string, rates: RateMap): BuiltRows {
  const { currency, splitMethod } = input;

  let entryTotal = input.amount;
  let entrySplits: { memberId: string; owed: number; shareValue: number | null }[] = [];
  const entryItems = input.items ?? [];

  if (splitMethod === 'ITEMIZED') {
    const { total } = computeItemizedSplit(
      entryItems.map((i) => ({ amount: i.amount, memberIds: i.memberIds })),
    );
    entryTotal = total;
  } else {
    const result = computeSplit(
      splitMethod,
      entryTotal,
      (input.splits ?? []).map((s) => ({
        memberId: s.memberId,
        value: s.value,
        included: s.included,
      })),
    );
    assertSplitSumsToTotal(entryTotal, result);
    entrySplits = result.map((r) => ({
      memberId: r.memberId,
      owed: r.owedAmount,
      shareValue: r.shareValue,
    }));
  }

  validatePayers(
    entryTotal,
    input.payers.map((p) => ({ amount: p.amount })),
  );

  const amountBase = convertMinor(entryTotal, currency, baseCurrency, rates);
  const exchangeRate = conversionRate(currency, baseCurrency, rates);

  const basePaid = proportionalConvert(
    input.payers.map((p) => p.amount),
    entryTotal,
    amountBase,
  );
  const payers = input.payers.map((p, i) => ({
    memberId: p.memberId,
    paidAmount: basePaid[i] ?? 0,
  }));

  let splits: BuiltRows['splits'];
  let items: BuiltRows['items'];

  if (splitMethod === 'ITEMIZED') {
    const baseItemAmounts = proportionalConvert(
      entryItems.map((i) => i.amount),
      entryTotal,
      amountBase,
    );
    const owed = new Map<string, number>();
    items = entryItems.map((it, idx) => {
      const baseAmount = baseItemAmounts[idx] ?? 0;
      // Equal split of the item among its members, exact to the cent.
      const shares = proportionalConvert(
        it.memberIds.map(() => 1),
        it.memberIds.length,
        baseAmount,
      );
      const itemSplits = it.memberIds.map((memberId, j) => {
        const share = shares[j] ?? 0;
        owed.set(memberId, (owed.get(memberId) ?? 0) + share);
        return { memberId, owedAmount: share };
      });
      return { description: it.description, amount: baseAmount, splits: itemSplits };
    });
    splits = [...owed.entries()].map(([memberId, owedAmount]) => ({
      memberId,
      owedAmount,
      shareValue: null,
    }));
  } else {
    const baseOwed = proportionalConvert(
      entrySplits.map((s) => s.owed),
      entryTotal,
      amountBase,
    );
    splits = entrySplits.map((s, i) => ({
      memberId: s.memberId,
      owedAmount: baseOwed[i] ?? 0,
      shareValue: s.shareValue,
    }));
    items = [];
  }

  if (sumCents(splits.map((s) => s.owedAmount)) !== amountBase) {
    throw new SplitError('BASE_SPLIT_MISMATCH', 'Split did not reconcile to the base amount.');
  }
  if (sumCents(payers.map((p) => p.paidAmount)) !== amountBase) {
    throw new SplitError('BASE_PAYER_MISMATCH', 'Payments did not reconcile to the base amount.');
  }

  return { entryTotal, amountBase, exchangeRate, payers, splits, items };
}

function assertMembersInGroup(rows: BuiltRows, validMemberIds: Set<string>) {
  const referenced = new Set<string>();
  rows.payers.forEach((p) => referenced.add(p.memberId));
  rows.splits.forEach((s) => referenced.add(s.memberId));
  rows.items.forEach((it) => it.splits.forEach((s) => referenced.add(s.memberId)));
  for (const id of referenced) {
    if (!validMemberIds.has(id)) {
      throw Errors.badRequest('An expense references someone who is not in this group.');
    }
  }
}

function computeNextRun(
  from: Date,
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  interval: number,
): Date {
  if (frequency === 'DAILY') return addDays(from, interval);
  if (frequency === 'WEEKLY') return addWeeks(from, interval);
  return addMonths(from, interval);
}

export interface ExpenseServiceContext {
  group: { id: string; baseCurrency: string };
  actorUserId: string | null;
  rates: RateMap;
}

async function validMemberIdSet(groupId: string): Promise<Set<string>> {
  const members = await prisma.groupMember.findMany({ where: { groupId }, select: { id: true } });
  return new Set(members.map((m) => m.id));
}

/** Create an expense (with optional recurring rule), record activity + notify. */
export async function createExpense(
  ctx: ExpenseServiceContext,
  input: CreateExpenseInput,
): Promise<string> {
  const rows = buildRows(input, ctx.group.baseCurrency, ctx.rates);
  assertMembersInGroup(rows, await validMemberIdSet(ctx.group.id));

  const expenseId = await prisma.$transaction(async (tx) => {
    let recurringRuleId: string | null = null;
    if (input.recurring) {
      const rule = await tx.recurringRule.create({
        data: {
          groupId: ctx.group.id,
          description: input.description,
          category: input.category,
          currency: input.currency,
          amount: input.amount,
          splitMethod: input.splitMethod,
          config: input as unknown as Prisma.InputJsonValue,
          frequency: input.recurring.frequency,
          interval: input.recurring.interval,
          nextRunAt: computeNextRun(
            input.date,
            input.recurring.frequency,
            input.recurring.interval,
          ),
          endDate: input.recurring.endDate ?? null,
          createdById: ctx.actorUserId,
        },
      });
      recurringRuleId = rule.id;
    }

    const expense = await tx.expense.create({
      data: {
        groupId: ctx.group.id,
        description: input.description,
        category: input.category,
        note: input.note ?? null,
        currency: input.currency,
        amount: rows.entryTotal,
        amountBase: rows.amountBase,
        exchangeRate: rows.exchangeRate,
        date: input.date,
        splitMethod: input.splitMethod,
        createdById: ctx.actorUserId,
        recurringRuleId,
        payers: { create: rows.payers },
        splits: { create: rows.splits },
        items: {
          create: rows.items.map((it) => ({
            description: it.description,
            amount: it.amount,
            splits: { create: it.splits },
          })),
        },
      },
    });
    return expense.id;
  });

  await afterExpenseChange(ctx, expenseId, 'EXPENSE_ADDED', input.description, rows.amountBase);
  return expenseId;
}

/** Replace an expense's rows in place (keeps comments + attachments). */
export async function updateExpense(
  ctx: ExpenseServiceContext,
  expenseId: string,
  input: CreateExpenseInput,
): Promise<void> {
  const rows = buildRows(input, ctx.group.baseCurrency, ctx.rates);
  assertMembersInGroup(rows, await validMemberIdSet(ctx.group.id));

  await prisma.$transaction(async (tx) => {
    await tx.expensePayer.deleteMany({ where: { expenseId } });
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expenseItem.deleteMany({ where: { expenseId } }); // cascades item splits

    await tx.expense.update({
      where: { id: expenseId },
      data: {
        description: input.description,
        category: input.category,
        note: input.note ?? null,
        currency: input.currency,
        amount: rows.entryTotal,
        amountBase: rows.amountBase,
        exchangeRate: rows.exchangeRate,
        date: input.date,
        splitMethod: input.splitMethod,
        payers: { create: rows.payers },
        splits: { create: rows.splits },
        items: {
          create: rows.items.map((it) => ({
            description: it.description,
            amount: it.amount,
            splits: { create: it.splits },
          })),
        },
      },
    });
  });

  await afterExpenseChange(ctx, expenseId, 'EXPENSE_UPDATED', input.description, rows.amountBase);
}

/** Soft-delete an expense so history/activity stays intact. */
export async function deleteExpense(
  ctx: ExpenseServiceContext,
  expenseId: string,
  description: string,
): Promise<void> {
  await prisma.expense.update({ where: { id: expenseId }, data: { deletedAt: new Date() } });
  await recordActivity({
    groupId: ctx.group.id,
    actorId: ctx.actorUserId,
    type: 'EXPENSE_DELETED',
    data: { description },
    expenseId,
  });
}

async function afterExpenseChange(
  ctx: ExpenseServiceContext,
  expenseId: string,
  type: 'EXPENSE_ADDED' | 'EXPENSE_UPDATED',
  description: string,
  amountBase: number,
) {
  await recordActivity({
    groupId: ctx.group.id,
    actorId: ctx.actorUserId,
    type,
    data: { description, amount: amountBase, currency: ctx.group.baseCurrency },
    expenseId,
  });
  if (type === 'EXPENSE_ADDED') {
    const recipients = await groupMemberUserIds(ctx.group.id, ctx.actorUserId);
    await notifyUsers(recipients, {
      type: 'EXPENSE_ADDED',
      data: {
        groupId: ctx.group.id,
        expenseId,
        description,
        amount: amountBase,
        currency: ctx.group.baseCurrency,
      },
    });
  }
}
