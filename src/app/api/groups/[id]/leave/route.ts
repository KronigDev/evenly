import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupMembership } from '@/lib/auth/authz';
import { recordActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import { apiHandler, ok } from '@/lib/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, membership } = await requireGroupMembership(id);

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { id: membership.id },
      data: { status: 'LEFT', leftAt: new Date() },
    });

    if (membership.role === 'ADMIN') {
      const remainingAdmins = await tx.groupMember.count({
        where: { groupId: id, status: 'ACTIVE', role: 'ADMIN' },
      });
      if (remainingAdmins === 0) {
        // Promote the earliest-joined active member with a real account.
        const successor = await tx.groupMember.findFirst({
          where: { groupId: id, status: 'ACTIVE', userId: { not: null } },
          orderBy: { joinedAt: 'asc' },
        });
        if (successor) {
          await tx.groupMember.update({ where: { id: successor.id }, data: { role: 'ADMIN' } });
        }
      }
    }
  });

  await recordActivity({
    groupId: id,
    actorId: user.id,
    type: 'MEMBER_LEFT',
    data: { memberId: membership.id, name: membership.displayName },
  });

  return ok({ success: true });
});
