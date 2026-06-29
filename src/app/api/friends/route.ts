import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/session';
import { getGroupBalances } from '@/lib/balances';
import { prisma } from '@/lib/db';
import { createDirectGroup } from '@/lib/groups';
import { apiHandler, created, ok, parseBody } from '@/lib/http';
import { createInvite } from '@/lib/invites';
import { sendInviteEmail } from '@/lib/mail';
import { absoluteUrl } from '@/lib/url';
import type { GroupSummaryDTO } from '@/lib/api/types';
import { createDirectSchema } from '@/lib/validation/group';
import { resolveLocale } from '@/i18n/request';

export const GET = apiHandler(async () => {
  const user = await requireUser();

  const groups = await prisma.group.findMany({
    where: {
      type: 'DIRECT',
      members: { some: { userId: user.id, status: 'ACTIVE' } },
    },
    include: {
      members: { include: { user: { select: { name: true } } } },
    },
  });

  const rows = await Promise.all(
    groups.map(async (group) => {
      const balances = await getGroupBalances(group.id);
      const yourMember = group.members.find((m) => m.userId === user.id) ?? null;
      const yourNet = yourMember ? (balances.net.get(yourMember.id) ?? 0) : 0;
      const counterpart = group.members.find((m) => m.id !== yourMember?.id) ?? null;
      const counterpartName = counterpart
        ? (counterpart.user?.name ?? counterpart.displayName)
        : null;
      const activeMembers = group.members.filter((m) => m.status === 'ACTIVE').length;
      const summary: GroupSummaryDTO = {
        id: group.id,
        type: group.type,
        name: group.name,
        description: group.description,
        emoji: group.emoji,
        color: group.color,
        baseCurrency: group.baseCurrency,
        archived: Boolean(group.archivedAt),
        memberCount: activeMembers,
        yourNet,
        counterpartName,
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
  const input = await parseBody(req, createDirectSchema);

  const { groupId } = await createDirectGroup(
    { id: user.id, name: user.name, email: user.email },
    { name: input.name ?? null, email: input.email ?? null },
    input.baseCurrency,
  );

  if (input.email) {
    try {
      const { token } = await createInvite({
        groupId,
        email: input.email,
        invitedById: user.id,
        displayName: input.name ?? null,
      });
      await sendInviteEmail({
        to: input.email,
        inviterName: user.name,
        groupName: user.name,
        acceptUrl: absoluteUrl(`/accept-invite/${token}`),
        locale: resolveLocale(user.locale),
      });
    } catch (err) {
      console.error('[friends] invite failed:', err);
    }
  }

  return created({ groupId });
});
