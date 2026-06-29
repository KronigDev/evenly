import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { consumeAuthToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { absoluteUrl } from '@/lib/url';

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.redirect(absoluteUrl('/login?error=verify'));

  const consumed = await consumeAuthToken(token, 'EMAIL_VERIFICATION');
  if (!consumed) return NextResponse.redirect(absoluteUrl('/login?error=verify'));

  if (consumed.userId) {
    await prisma.user
      .update({ where: { id: consumed.userId }, data: { emailVerifiedAt: new Date() } })
      .catch(() => undefined);
  } else {
    await prisma.user.updateMany({
      where: { email: consumed.email },
      data: { emailVerifiedAt: new Date() },
    });
  }

  const user = await getCurrentUser();
  return NextResponse.redirect(absoluteUrl(user ? '/settings?verified=1' : '/login?verified=1'));
}
