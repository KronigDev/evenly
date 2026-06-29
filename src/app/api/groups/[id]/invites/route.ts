import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupMembership } from '@/lib/auth/authz';
import { recordActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import { apiHandler, created, ok, parseBody } from '@/lib/http';
import { createInvite } from '@/lib/invites';
import { sendInviteEmail } from '@/lib/mail';
import { absoluteUrl } from '@/lib/url';
import type { PendingInviteDTO } from '@/lib/api/types';
import { inviteMemberSchema } from '@/lib/validation/member';
import { resolveLocale } from '@/i18n/request';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await requireGroupMembership(id);

  const invites = await prisma.invite.findMany({
    where: { groupId: id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  const dto: PendingInviteDTO[] = invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    status: invite.status,
    memberId: invite.memberId,
    expiresAt: invite.expiresAt.toISOString(),
  }));

  return ok(dto);
});

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, group } = await requireGroupMembership(id);
  const { email, displayName } = await parseBody(req, inviteMemberSchema);

  const { invite, token } = await createInvite({
    groupId: id,
    email,
    invitedById: user.id,
    displayName,
  });

  const shareUrl = absoluteUrl(`/accept-invite/${token}`);

  await sendInviteEmail({
    to: email,
    inviterName: user.name,
    groupName: group.name,
    acceptUrl: shareUrl,
    locale: resolveLocale(user.locale),
  }).catch((err) => console.error('[invites] email failed:', err));

  await recordActivity({
    groupId: id,
    actorId: user.id,
    type: 'MEMBER_INVITED',
    data: { email, memberId: invite.memberId },
  });

  const dto: PendingInviteDTO = {
    id: invite.id,
    email: invite.email,
    status: invite.status,
    memberId: invite.memberId,
    expiresAt: invite.expiresAt.toISOString(),
  };

  return created({ invite: dto, shareUrl });
});
