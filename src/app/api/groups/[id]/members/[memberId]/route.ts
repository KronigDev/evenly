import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupAdmin } from '@/lib/auth/authz';
import { recordActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, noContent, ok, parseBody } from '@/lib/http';
import { serializeMember } from '@/lib/serialize';
import { updateMemberSchema } from '@/lib/validation/member';

interface RouteContext {
  params: Promise<{ id: string; memberId: string }>;
}

export const PATCH = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id, memberId } = await params;
  await assertCsrf(req);
  const { user } = await requireGroupAdmin(id);
  const input = await parseBody(req, updateMemberSchema);

  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId: id } });
  if (!member) throw Errors.notFound('Member not found.');

  const updated = await prisma.groupMember.update({
    where: { id: member.id },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    },
    include: { user: { select: { name: true, image: true } } },
  });

  return ok(serializeMember(updated, user.id));
});

export const DELETE = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id, memberId } = await params;
  await assertCsrf(req);
  const { user, membership } = await requireGroupAdmin(id);

  const member = await prisma.groupMember.findFirst({ where: { id: memberId, groupId: id } });
  if (!member) throw Errors.notFound('Member not found.');
  if (member.id === membership.id) {
    throw Errors.badRequest('Use “leave group” to remove yourself.');
  }

  await prisma.groupMember.update({
    where: { id: member.id },
    data: { status: 'LEFT', leftAt: new Date() },
  });

  await recordActivity({
    groupId: id,
    actorId: user.id,
    type: 'MEMBER_REMOVED',
    data: { memberId: member.id, name: member.displayName },
  });

  return noContent();
});
