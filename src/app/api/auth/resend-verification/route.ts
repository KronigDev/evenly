import { EMAIL_VERIFY_TTL_MS } from '@/lib/auth/constants';
import { assertCsrf } from '@/lib/auth/csrf';
import { rateLimit } from '@/lib/auth/rate-limit';
import { requireUser } from '@/lib/auth/session';
import { createAuthToken } from '@/lib/auth/tokens';
import { apiHandler, Errors, ok } from '@/lib/http';
import { sendVerifyEmail } from '@/lib/mail';
import { absoluteUrl } from '@/lib/url';
import { resolveLocale } from '@/i18n/request';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();
  const limit = rateLimit(`resend:${user.id}`, 4, 10 * 60_000);
  if (!limit.ok) throw Errors.rateLimited(undefined, limit.retryAfter);

  if (user.emailVerifiedAt) return ok({ alreadyVerified: true });

  const token = await createAuthToken({
    type: 'EMAIL_VERIFICATION',
    email: user.email,
    userId: user.id,
    ttlMs: EMAIL_VERIFY_TTL_MS,
  });
  await sendVerifyEmail({
    to: user.email,
    url: absoluteUrl(`/api/auth/verify-email/consume?token=${token}`),
    locale: resolveLocale(user.locale),
  });
  return ok({ sent: true });
});
