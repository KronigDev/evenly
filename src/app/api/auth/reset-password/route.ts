import { assertCsrf } from '@/lib/auth/csrf';
import { hashPassword } from '@/lib/auth/password';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { createSession, destroyAllUserSessions } from '@/lib/auth/session';
import { consumeAuthToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { setLocaleCookie } from '@/i18n/locale';
import { resolveLocale } from '@/i18n/request';
import { resetPasswordSchema } from '@/lib/validation/auth';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const ip = clientIp(req);
  const limit = rateLimit(`reset:${ip}`, 10, 10 * 60_000);
  if (!limit.ok) throw Errors.rateLimited(undefined, limit.retryAfter);

  const { token, password } = await parseBody(req, resetPasswordSchema);
  const consumed = await consumeAuthToken(token, 'PASSWORD_RESET');
  if (!consumed) throw Errors.badRequest('This reset link is invalid or has expired.');

  const user = consumed.userId
    ? await prisma.user.findUnique({ where: { id: consumed.userId } })
    : await prisma.user.findUnique({ where: { email: consumed.email } });
  if (!user || user.deletedAt) throw Errors.badRequest('Account not found.');

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });

  // Invalidate all existing sessions, then sign the user in fresh.
  await destroyAllUserSessions(user.id);
  await createSession(user.id, { userAgent: req.headers.get('user-agent'), ip });
  await setLocaleCookie(resolveLocale(user.locale));

  return ok({ success: true });
});
