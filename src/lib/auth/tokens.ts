import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { TokenType } from '@prisma/client';
import { prisma } from '@/lib/db';

/** A cryptographically random, URL-safe opaque token. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Stable hash of a token for at-rest storage (we never store raw tokens). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface CreateAuthTokenInput {
  type: TokenType;
  email: string;
  userId?: string | null;
  redirectTo?: string | null;
  ttlMs: number;
}

/**
 * Create a single-use auth token (magic link / verification / password reset).
 * Returns the RAW token to embed in a link; only its hash is persisted.
 * Any previous unconsumed tokens of the same type for this email are cleared.
 */
export async function createAuthToken(input: CreateAuthTokenInput): Promise<string> {
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const email = input.email.toLowerCase();

  await prisma.$transaction([
    prisma.authToken.deleteMany({
      where: { type: input.type, email, consumedAt: null },
    }),
    prisma.authToken.create({
      data: {
        type: input.type,
        email,
        userId: input.userId ?? null,
        redirectTo: input.redirectTo ?? null,
        tokenHash,
        expiresAt: new Date(Date.now() + input.ttlMs),
      },
    }),
  ]);

  return token;
}

export interface ConsumedToken {
  id: string;
  email: string;
  userId: string | null;
  redirectTo: string | null;
}

/**
 * Atomically consume a token: valid, unexpired, unconsumed and of the right
 * type. Returns null if it cannot be used. Marking consumed in the same
 * conditional update guarantees a token cannot be used twice.
 */
export async function consumeAuthToken(
  rawToken: string,
  type: TokenType,
): Promise<ConsumedToken | null> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.type !== type) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  const result = await prisma.authToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (result.count !== 1) return null;

  return {
    id: record.id,
    email: record.email,
    userId: record.userId,
    redirectTo: record.redirectTo,
  };
}

/** Peek at a token without consuming it (used to render acceptance pages). */
export async function peekAuthToken(
  rawToken: string,
  type: TokenType,
): Promise<ConsumedToken | null> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.type !== type) return null;
  if (record.consumedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;
  return {
    id: record.id,
    email: record.email,
    userId: record.userId,
    redirectTo: record.redirectTo,
  };
}
