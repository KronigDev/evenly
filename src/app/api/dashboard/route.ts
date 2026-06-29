import { requireUser } from '@/lib/auth/session';
import { getGroupBalances } from '@/lib/balances';
import { convertMinor } from '@/lib/currency';
import { prisma } from '@/lib/db';
import { getRateMap } from '@/lib/exchange-rates';
import { apiHandler, ok } from '@/lib/http';
import type { DashboardDTO, GroupSummaryDTO } from '@/lib/api/types';

export const GET = apiHandler(async () => {
  const user = await requireUser();

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: user.id, status: 'ACTIVE' } } },
    include: {
      members: { where: { status: 'ACTIVE' }, select: { id: true, userId: true } },
    },
  });

  const rates = await getRateMap();

  const results = await Promise.all(
    groups.map(async (group) => {
      const balances = await getGroupBalances(group.id);
      const yourMember = group.members.find((m) => m.userId === user.id) ?? null;
      const yourNet = yourMember ? (balances.net.get(yourMember.id) ?? 0) : 0;
      const converted = convertMinor(yourNet, group.baseCurrency, user.defaultCurrency, rates);
      return { group, yourNet, converted };
    }),
  );

  let totalOwed = 0;
  let totalOwe = 0;
  const standardRows: { summary: GroupSummaryDTO; archived: boolean; updatedAt: number }[] = [];

  for (const { group, yourNet, converted } of results) {
    if (converted > 0) totalOwed += converted;
    else if (converted < 0) totalOwe += Math.abs(converted);

    if (group.type === 'STANDARD') {
      standardRows.push({
        summary: {
          id: group.id,
          type: group.type,
          name: group.name,
          description: group.description,
          emoji: group.emoji,
          color: group.color,
          baseCurrency: group.baseCurrency,
          archived: Boolean(group.archivedAt),
          memberCount: group.members.length,
          yourNet,
        },
        archived: Boolean(group.archivedAt),
        updatedAt: group.updatedAt.getTime(),
      });
    }
  }

  standardRows.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });

  const dto: DashboardDTO = {
    totalOwed,
    totalOwe,
    net: totalOwed - totalOwe,
    currency: user.defaultCurrency,
    groups: standardRows.map((r) => r.summary),
  };

  return ok(dto);
});
