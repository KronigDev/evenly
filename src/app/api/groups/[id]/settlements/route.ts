import { requireGroupMembership } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { apiHandler, created, Errors, ok, parseBody } from '@/lib/http';
import { serializeSettlement } from '@/lib/serialize';
import { createSettlement } from '@/lib/settlements';
import { createSettlementSchema } from '@/lib/validation/settlement';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await requireGroupMembership(id);

  const settlements = await prisma.settlement.findMany({
    where: { groupId: id },
    orderBy: { date: 'desc' },
  });

  return ok(settlements.map(serializeSettlement));
});

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, group } = await requireGroupMembership(id);
  const body = await parseBody(req, createSettlementSchema);

  const settlementId = await createSettlement({
    group: { id: group.id, baseCurrency: group.baseCurrency },
    fromMemberId: body.fromMemberId,
    toMemberId: body.toMemberId,
    amount: body.amount,
    currency: body.currency,
    date: body.date,
    note: body.note,
    actorUserId: user.id,
  });

  const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
  if (!settlement) throw Errors.internal('Settlement could not be loaded after creation.');

  return created(serializeSettlement(settlement));
});
