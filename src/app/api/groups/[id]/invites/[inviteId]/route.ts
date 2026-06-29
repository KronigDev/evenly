import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupMembership } from '@/lib/auth/authz';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, noContent } from '@/lib/http';
import { revokeInvite } from '@/lib/invites';

interface RouteContext {
  params: Promise<{ id: string; inviteId: string }>;
}

export const DELETE = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id, inviteId } = await params;
  await assertCsrf(req);
  const { user, membership } = await requireGroupMembership(id);

  const invite = await prisma.invite.findFirst({ where: { id: inviteId, groupId: id } });
  if (!invite) throw Errors.notFound('Invitation not found.');

  const isAdmin = membership.role === 'ADMIN';
  const isInviter = invite.invitedById === user.id;
  if (!isAdmin && !isInviter) {
    throw Errors.forbidden('Only an admin or the inviter can revoke this invitation.');
  }

  await revokeInvite(id, inviteId);

  return noContent();
});
