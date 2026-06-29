import {
  eachDayOfInterval,
  eachMonthOfInterval,
  format,
  startOfDay,
  startOfMonth,
  subMonths,
  subYears,
} from 'date-fns';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { StatsDTO, StatsPointDTO } from '@/lib/api/types';
import { requireGroupMembership } from '@/lib/auth/authz';
import { prisma } from '@/lib/db';
import { apiHandler, ok, parseQuery } from '@/lib/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const querySchema = z.object({
  range: z.enum(['month', '3months', '6months', 'year', 'all']).default('month'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const DAY_KEY = 'yyyy-MM-dd';
const MONTH_KEY = 'yyyy-MM';

export const GET = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  const { group, membership } = await requireGroupMembership(id);

  const query = parseQuery(new URL(req.url).searchParams, querySchema);
  const now = new Date();

  let from: Date | undefined = query.from;
  let to: Date | undefined = query.to;
  if (!from && query.range !== 'all') {
    if (query.range === 'month') from = subMonths(now, 1);
    else if (query.range === '3months') from = subMonths(now, 3);
    else if (query.range === '6months') from = subMonths(now, 6);
    else from = subYears(now, 1);
  }
  if (query.range !== 'all' && !to) to = now;

  const where: Prisma.ExpenseWhereInput = { groupId: id, deletedAt: null };
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [expenses, members] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        amountBase: true,
        category: true,
        date: true,
        payers: { select: { memberId: true, paidAmount: true } },
        splits: { select: { memberId: true, owedAmount: true } },
      },
    }),
    prisma.groupMember.findMany({
      where: { groupId: id },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const nameOf = new Map<string, string>(members.map((m) => [m.id, m.user?.name ?? m.displayName]));

  const granularity: 'day' | 'month' = query.range === 'month' ? 'day' : 'month';
  const keyFmt = granularity === 'day' ? DAY_KEY : MONTH_KEY;

  let total = 0;
  let yourShare = 0;
  const byCategoryMap = new Map<string, number>();
  const byMemberMap = new Map<string, number>();
  const overTimeMap = new Map<string, number>();

  for (const e of expenses) {
    total += e.amountBase;
    byCategoryMap.set(e.category, (byCategoryMap.get(e.category) ?? 0) + e.amountBase);

    for (const p of e.payers) {
      byMemberMap.set(p.memberId, (byMemberMap.get(p.memberId) ?? 0) + p.paidAmount);
    }
    for (const s of e.splits) {
      if (s.memberId === membership.id) yourShare += s.owedAmount;
    }

    const bucket = format(e.date, keyFmt);
    overTimeMap.set(bucket, (overTimeMap.get(bucket) ?? 0) + e.amountBase);
  }

  // Build a continuous, zero-filled timeline across the active window.
  let overTime: StatsPointDTO[] = [];
  if (expenses.length > 0) {
    const dates = expenses.map((e) => e.date.getTime());
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    const start = from ?? earliest;
    const end = to ?? latest;

    if (start.getTime() <= end.getTime()) {
      const buckets =
        granularity === 'day'
          ? eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) })
          : eachMonthOfInterval({ start: startOfMonth(start), end: startOfMonth(end) });
      overTime = buckets.map((d) => {
        const label = format(d, keyFmt);
        return { label, total: overTimeMap.get(label) ?? 0 };
      });
    } else {
      overTime = [...overTimeMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([label, value]) => ({ label, total: value }));
    }
  }

  const byCategory = [...byCategoryMap.entries()]
    .map(([category, value]) => ({ category, total: value }))
    .sort((a, b) => b.total - a.total);

  const byMember = [...byMemberMap.entries()]
    .filter(([, value]) => value > 0)
    .map(([memberId, value]) => ({
      memberId,
      name: nameOf.get(memberId) ?? memberId,
      total: value,
    }))
    .sort((a, b) => b.total - a.total);

  const dto: StatsDTO = {
    currency: group.baseCurrency,
    total,
    yourShare,
    overTime,
    byCategory,
    byMember,
  };

  return ok(dto);
});
