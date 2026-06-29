import { PASSWORD_RESET_TTL_MS } from '@/lib/auth/constants';
import { assertCsrf } from '@/lib/auth/csrf';
import { clientIp, rateLimit } from '@/lib/auth/rate-limit';
import { createAuthToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { sendPasswordResetEmail } from '@/lib/mail';
import { absoluteUrl } from '@/lib/url';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { resolveLocale } from '@/i18n/request';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const ip = clientIp(req);
  const limit = rateLimit(`forgot:${ip}`, 6, 10 * 60_000);
  if (!limit.ok) throw Errors.rateLimited(undefined, limit.retryAfter);

  const { email } = await parseBody(req, forgotPasswordSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.deletedAt) {
    const token = await createAuthToken({
      type: 'PASSWORD_RESET',
      email,
      userId: user.id,
      ttlMs: PASSWORD_RESET_TTL_MS,
    });
    await sendPasswordResetEmail({
      to: email,
      url: absoluteUrl(`/reset-password?token=${token}`),
      locale: resolveLocale(user.locale),
    }).catch((err) => console.error('[forgot-password] email failed:', err));
  }

  // Always succeed — never reveal whether an account exists.
  return ok({ sent: true });
});
