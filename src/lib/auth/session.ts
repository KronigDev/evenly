import { cookies } from 'next/headers';
import { cache } from 'react';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/http';
import { COOKIE_SECURE, SESSION_COOKIE, SESSION_TTL_MS } from './constants';
import { generateOpaqueToken, hashToken } from './tokens';

export type SessionUser = Omit<User, 'passwordHash'>;

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession(userId: string, meta?: SessionMeta): Promise<void> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
      ip: meta?.ip ?? null,
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Current signed-in user (memoized per request), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || session.user.deletedAt) {
    return null;
  }

  const { passwordHash: _passwordHash, ...safe } = session.user;
  return safe;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

/** Whether the current user has a password set (vs magic-link-only). */
export async function currentUserHasPassword(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  return Boolean(row?.passwordHash);
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
