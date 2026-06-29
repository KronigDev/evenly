import type { BalancesDTO, TransferDTO } from '@/lib/api/types';
import { requireGroupMembership } from '@/lib/auth/authz';
import { getGroupBalances } from '@/lib/balances';
import { prisma } from '@/lib/db';
import { apiHandler, ok } from '@/lib/http';
import { serializeMember } from '@/lib/serialize';
import type { Transfer } from '@/lib/debt';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function toTransferDTO(t: Transfer): TransferDTO {
  return { fromMemberId: t.fromMemberId, toMemberId: t.toMemberId, amount: t.amount };
}

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  const { id } = await params;
  const { user, group } = await requireGroupMembership(id);

  const balances = await getGroupBalances(id);

  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    include: { user: { select: { name: true, image: true } } },
  });

  const dto: BalancesDTO = {
    currency: group.baseCurrency,
    simplifyDebts: group.simplifyDebts,
    members: members.map((m) => serializeMember(m, user.id)),
    net: [...balances.net.entries()].map(([memberId, net]) => ({ memberId, net })),
    simplified: balances.simplified.map(toTransferDTO),
    pairwise: balances.pairwise.map(toTransferDTO),
  };

  return ok(dto);
});
