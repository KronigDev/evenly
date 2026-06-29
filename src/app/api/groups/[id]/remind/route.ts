import { z } from 'zod';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupMembership } from '@/lib/auth/authz';
import { rateLimit } from '@/lib/auth/rate-limit';
import { notifyUsers, recordActivity } from '@/lib/activity';
import { getGroupBalances } from '@/lib/balances';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { sendReminderEmail } from '@/lib/mail';
import { formatMoney } from '@/lib/money';
import { absoluteUrl } from '@/lib/url';
import { resolveLocale } from '@/i18n/request';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const remindSchema = z.object({ memberId: z.string().min(1) });

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, group } = await requireGroupMembership(id);
  const { memberId } = await parseBody(req, remindSchema);

  const member = await prisma.groupMember.findFirst({
    where: { id: memberId, groupId: id },
    include: { user: { select: { id: true, email: true, locale: true } } },
  });
  if (!member) throw Errors.notFound('Member not found.');
  if (!member.userId || !member.user || !member.user.email) {
    throw Errors.badRequest('This person has not joined yet.');
  }

  const balances = await getGroupBalances(id);
  const net = balances.net.get(member.id) ?? 0;
  if (net >= 0) {
    throw Errors.badRequest('This person does not owe anything right now.');
  }
  const amount = Math.abs(net);

  const limit = rateLimit(`remind:${user.id}:${member.id}`, 3, 60 * 60 * 1000);
  if (!limit.ok) throw Errors.rateLimited(undefined, limit.retryAfter);

  const targetLocale = resolveLocale(member.user.locale);
  await sendReminderEmail({
    to: member.user.email,
    fromName: user.name,
    amountFormatted: formatMoney(amount, group.baseCurrency, targetLocale),
    groupName: group.name,
    url: absoluteUrl(`/groups/${id}`),
    locale: targetLocale,
  }).catch((err) => console.error('[remind] email failed:', err));

  await notifyUsers([member.userId], {
    type: 'REMINDER_RECEIVED',
    data: { groupId: id, amount, currency: group.baseCurrency },
  });

  await recordActivity({
    groupId: id,
    actorId: user.id,
    type: 'REMINDER_SENT',
    data: { memberId: member.id, amount, currency: group.baseCurrency },
  });

  return ok({ sent: true });
});
