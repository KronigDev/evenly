import { requireExpenseAccess } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import {
  deleteExpense,
  getExpenseFull,
  updateExpense,
  type ExpenseServiceContext,
} from '@/lib/expenses';
import { getRateMap } from '@/lib/exchange-rates';
import { apiHandler, Errors, noContent, ok, parseBody } from '@/lib/http';
import { serializeExpense } from '@/lib/serialize';
import { updateExpenseSchema } from '@/lib/validation/expense';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await requireExpenseAccess(id);

  const full = await getExpenseFull(id);
  if (!full) throw Errors.notFound('Expense not found.');

  return ok(serializeExpense(full));
});

export const PATCH = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, expense } = await requireExpenseAccess(id);

  const group = await prisma.group.findUnique({
    where: { id: expense.groupId },
    select: { id: true, baseCurrency: true },
  });
  if (!group) throw Errors.notFound('Group not found.');

  const body = await parseBody(req, updateExpenseSchema);

  const ctx: ExpenseServiceContext = {
    group: { id: group.id, baseCurrency: group.baseCurrency },
    actorUserId: user.id,
    rates: await getRateMap(),
  };

  await updateExpense(ctx, id, body);

  const full = await getExpenseFull(id);
  if (!full) throw Errors.notFound('Expense not found.');

  return ok(serializeExpense(full));
});

export const DELETE = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, expense } = await requireExpenseAccess(id);

  // deleteExpense only soft-deletes + records activity; it never converts money,
  // so a rate map is unnecessary here.
  const ctx: ExpenseServiceContext = {
    group: { id: expense.groupId, baseCurrency: '' },
    actorUserId: user.id,
    rates: {},
  };

  await deleteExpense(ctx, id, expense.description);

  return noContent();
});
