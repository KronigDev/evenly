import { assertCsrf } from '@/lib/auth/csrf';
import { verifyPassword } from '@/lib/auth/password';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { mergePlaceholdersForUser } from '@/lib/invites';
import { setLocaleCookie } from '@/i18n/locale';
import { resolveLocale } from '@/i18n/request';
import { loginSchema } from '@/lib/validation/auth';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const ip = clientIp(req);
  const { email, password } = await parseBody(req, loginSchema);

  const limit = rateLimit(`login:${ip}:${email}`, 8, 5 * 60_000);
  if (!limit.ok) throw Errors.rateLimited('Too many attempts. Try again later.', limit.retryAfter);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || !user.passwordHash) {
    throw Errors.unauthorized('Invalid email or password.');
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) throw Errors.unauthorized('Invalid email or password.');

  await createSession(user.id, { userAgent: req.headers.get('user-agent'), ip });
  await mergePlaceholdersForUser(user.id, user.email);
  await setLocaleCookie(resolveLocale(user.locale));

  const { passwordHash: _ph, ...safe } = user;
  return ok(safe);
});
