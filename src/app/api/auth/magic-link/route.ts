import { after } from 'next/server';
import { MAGIC_LINK_TTL_MS } from '@/lib/auth/constants';
import { assertCsrf } from '@/lib/auth/csrf';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { inviteTokenFromPath, registrationMode } from '@/lib/auth/registration';
import { createAuthToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { sendMagicLinkEmail } from '@/lib/mail';
import { absoluteUrl, safeNext } from '@/lib/url';
import { magicLinkSchema } from '@/lib/validation/auth';
import { getRequestLocale } from '@/i18n/locale';
import { resolveLocale } from '@/i18n/request';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const ip = clientIp(req);
  const limit = rateLimit(`magic:${ip}`, 6, 10 * 60_000);
  if (!limit.ok) throw Errors.rateLimited(undefined, limit.retryAfter);

  const { email, redirectTo } = await parseBody(req, magicLinkSchema);
  const next = safeNext(redirectTo, '/dashboard');
  // Read the cookie now (request-scoped); used only if we email an unknown address.
  const requestLocale = await getRequestLocale();

  // Do all account-dependent work AFTER the response is sent, so the response
  // time never reveals whether an account exists. The body is always
  // {sent:true}; a link is emailed only for an existing user or an authorized
  // (bootstrap / matching-invite) new email.
  after(async () => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      const isActiveUser = Boolean(user && !user.deletedAt);
      if (!isActiveUser) {
        const mode = await registrationMode({ email, inviteToken: inviteTokenFromPath(next) });
        if (mode === 'closed') return;
      }
      const token = await createAuthToken({
        type: 'MAGIC_LINK',
        email,
        userId: isActiveUser ? user!.id : null,
        redirectTo: next,
        ttlMs: MAGIC_LINK_TTL_MS,
      });
      const locale = isActiveUser ? resolveLocale(user!.locale) : requestLocale;
      await sendMagicLinkEmail({
        to: email,
        url: absoluteUrl(`/api/auth/magic-link/consume?token=${token}`),
        locale,
      });
    } catch (err) {
      console.error('[magic-link] delivery failed:', err);
    }
  });

  // Always succeed — never reveal whether an account exists (body or timing).
  return ok({ sent: true });
});
