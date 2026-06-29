import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';
import { consumeAuthToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { mergePlaceholdersForUser } from '@/lib/invites';
import { absoluteUrl, safeNext } from '@/lib/url';
import { getRequestLocale, setLocaleCookie } from '@/i18n/locale';
import { resolveLocale } from '@/i18n/request';

function deriveName(email: string): string {
  const local = email.split('@')[0] ?? email;
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  return (
    cleaned
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Friend'
  );
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.redirect(absoluteUrl('/magic-link?error=invalid'));

  const consumed = await consumeAuthToken(token, 'MAGIC_LINK');
  if (!consumed) return NextResponse.redirect(absoluteUrl('/magic-link?error=invalid'));

  const email = consumed.email;
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    user = await prisma.user.create({
      data: {
        email,
        name: deriveName(email),
        emailVerifiedAt: new Date(),
        locale: await getRequestLocale(),
      },
    });
  } else if (!user.emailVerifiedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  await createSession(user.id, { userAgent: req.headers.get('user-agent'), ip: clientIp(req) });
  await mergePlaceholdersForUser(user.id, email);
  await setLocaleCookie(resolveLocale(user.locale));

  return NextResponse.redirect(absoluteUrl(safeNext(consumed.redirectTo, '/dashboard')));
}
