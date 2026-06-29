import { EMAIL_VERIFY_TTL_MS } from '@/lib/auth/constants';
import { hashPassword } from '@/lib/auth/password';
import { rateLimit, clientIp } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';
import { createAuthToken } from '@/lib/auth/tokens';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { apiHandler, created, Errors, parseBody } from '@/lib/http';
import { mergePlaceholdersForUser } from '@/lib/invites';
import { sendVerifyEmail } from '@/lib/mail';
import { absoluteUrl } from '@/lib/url';
import { registerSchema } from '@/lib/validation/auth';
import { setLocaleCookie } from '@/i18n/locale';
import type { Locale } from '@/i18n/request';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const ip = clientIp(req);
  const limit = rateLimit(`register:${ip}`, 10, 60_000);
  if (!limit.ok) throw Errors.rateLimited(undefined, limit.retryAfter);

  const { name, email, password, locale } = await parseBody(req, registerSchema);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt) {
    throw Errors.conflict('An account with this email already exists.', { field: 'email' });
  }

  const passwordHash = await hashPassword(password);
  const resolvedLocale: Locale = locale ?? 'en';
  const user = await prisma.user.create({
    data: { name, email, passwordHash, locale: resolvedLocale },
  });

  const token = await createAuthToken({
    type: 'EMAIL_VERIFICATION',
    email,
    userId: user.id,
    ttlMs: EMAIL_VERIFY_TTL_MS,
  });
  await sendVerifyEmail({
    to: email,
    url: absoluteUrl(`/api/auth/verify-email/consume?token=${token}`),
    locale: resolvedLocale,
  }).catch((err) => console.error('[register] verify email failed:', err));

  await createSession(user.id, { userAgent: req.headers.get('user-agent'), ip });
  await mergePlaceholdersForUser(user.id, email);
  await setLocaleCookie(resolvedLocale);

  const { passwordHash: _ph, ...safe } = user;
  return created(safe);
});
