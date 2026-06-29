import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireGroupMembership } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { createExpense, expenseInclude, getExpenseFull } from '@/lib/expenses';
import { getRateMap } from '@/lib/exchange-rates';
import { apiHandler, created, Errors, ok, parseBody, parseQuery } from '@/lib/http';
import { serializeExpense } from '@/lib/serialize';
import { createExpenseSchema } from '@/lib/validation/expense';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const listQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  category: z.string().min(1).optional(),
  memberId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().min(1).optional(),
});

export const GET = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await requireGroupMembership(id);

  const query = parseQuery(new URL(req.url).searchParams, listQuerySchema);

  const where: Prisma.ExpenseWhereInput = { groupId: id, deletedAt: null };
  if (query.category) where.category = query.category;
  if (query.memberId) {
    where.OR = [
      { payers: { some: { memberId: query.memberId } } },
      { splits: { some: { memberId: query.memberId } } },
    ];
  }
  if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }
  if (query.q) where.description = { contains: query.q, mode: 'insensitive' };

  const rows = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? last.id : null;

  return ok({ expenses: page.map(serializeExpense), nextCursor });
});

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, group } = await requireGroupMembership(id);
  const body = await parseBody(req, createExpenseSchema);

  const ctx = {
    group: { id: group.id, baseCurrency: group.baseCurrency },
    actorUserId: user.id,
    rates: await getRateMap(),
  };

  const expenseId = await createExpense(ctx, body);
  const full = await getExpenseFull(expenseId);
  if (!full) throw Errors.internal('Expense could not be loaded after creation.');

  return created(serializeExpense(full));
});
