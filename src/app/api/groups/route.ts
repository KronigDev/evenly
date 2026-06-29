import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/session';
import { getGroupBalances } from '@/lib/balances';
import { prisma } from '@/lib/db';
import { createStandardGroup } from '@/lib/groups';
import { apiHandler, created, Errors, ok, parseBody } from '@/lib/http';
import { serializeGroup } from '@/lib/serialize';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { createGroupSchema } from '@/lib/validation/group';

export const GET = apiHandler(async () => {
  const user = await requireUser();

  const groups = await prisma.group.findMany({
    where: {
      type: 'STANDARD',
      members: { some: { userId: user.id, status: 'ACTIVE' } },
    },
    include: {
      members: { where: { status: 'ACTIVE' }, select: { id: true, userId: true } },
    },
  });

  const rows = await Promise.all(
    groups.map(async (group) => {
      const balances = await getGroupBalances(group.id);
      const yourMember = group.members.find((m) => m.userId === user.id) ?? null;
      const yourNet = yourMember ? (balances.net.get(yourMember.id) ?? 0) : 0;
      const summary: GroupSummaryDTO = {
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
      };
      return { summary, archived: Boolean(group.archivedAt), updatedAt: group.updatedAt.getTime() };
    }),
  );

  rows.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });

  return ok(rows.map((r) => r.summary));
});

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();
  const input = await parseBody(req, createGroupSchema);

  const groupId = await createStandardGroup(input, {
    id: user.id,
    name: user.name,
    email: user.email,
  });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: { select: { name: true, image: true } } } } },
  });
  if (!group) throw Errors.internal();

  return created(serializeGroup(group, user.id));
});
