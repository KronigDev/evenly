import { notifyUsers, recordActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/http';

export async function createSettlement(params: {
  group: { id: string; baseCurrency: string };
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency?: string | null;
  date?: Date | null;
  note?: string | null;
  actorUserId: string | null;
}): Promise<string> {
  const members = await prisma.groupMember.findMany({
    where: { groupId: params.group.id, id: { in: [params.fromMemberId, params.toMemberId] } },
    select: { id: true, userId: true },
  });
  if (members.length !== 2) throw Errors.badRequest('Settlement references a non-member.');

  const settlement = await prisma.settlement.create({
    data: {
      groupId: params.group.id,
      fromMemberId: params.fromMemberId,
      toMemberId: params.toMemberId,
      amount: params.amount,
      currency: params.currency ?? params.group.baseCurrency,
      date: params.date ?? new Date(),
      note: params.note ?? null,
      createdById: params.actorUserId,
    },
  });

  await recordActivity({
    groupId: params.group.id,
    actorId: params.actorUserId,
    type: 'SETTLEMENT_ADDED',
    data: {
      amount: settlement.amount,
      currency: settlement.currency,
      fromMemberId: params.fromMemberId,
      toMemberId: params.toMemberId,
    },
  });

  await notifyUsers(
    members.map((m) => m.userId),
    {
      type: 'SETTLEMENT_ADDED',
      data: { groupId: params.group.id, amount: settlement.amount, currency: settlement.currency },
    },
  );

  return settlement.id;
}

export async function deleteSettlement(
  groupId: string,
  settlementId: string,
  actorUserId: string | null,
): Promise<void> {
  const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, groupId } });
  if (!settlement) throw Errors.notFound('Settlement not found.');
  await prisma.settlement.delete({ where: { id: settlement.id } });
  await recordActivity({
    groupId,
    actorId: actorUserId,
    type: 'SETTLEMENT_DELETED',
    data: { amount: settlement.amount, currency: settlement.currency },
  });
}
