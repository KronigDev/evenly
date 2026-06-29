import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok } from '@/lib/http';
import { serializeActivity } from '@/lib/serialize';
import type { ActivityDTO } from '@/lib/api/types';

export const GET = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const groupIdFilter = new URL(req.url).searchParams.get('groupId');

  const memberships = await prisma.groupMember.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { groupId: true },
  });
  const groupIds = memberships.map((m) => m.groupId);

  if (groupIdFilter && !groupIds.includes(groupIdFilter)) {
    throw Errors.forbidden('You are not a member of this group.');
  }
  if (groupIds.length === 0) return ok([] as ActivityDTO[]);

  const where = groupIdFilter ? { groupId: groupIdFilter } : { groupId: { in: groupIds } };

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      actor: { select: { name: true, image: true } },
      group: { select: { name: true } },
    },
  });

  return ok(activities.map(serializeActivity));
});
