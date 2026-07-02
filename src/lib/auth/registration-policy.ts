/**
 * Pure decision logic for self-registration. Kept free of env/db imports so it
 * is trivially unit-testable; the server-side gate lives in registration.ts.
 */

export type RegistrationMode = 'open' | 'bootstrap' | 'invite' | 'closed';

/**
 * Decide whether an account may be created:
 * - `open`      — REGISTRATION_ENABLED=true, anyone may register.
 * - `bootstrap` — the instance has no users yet; the very first account may
 *                 always be created regardless of the flag.
 * - `invite`    — registration is disabled, but a valid group invitation
 *                 authorizes this account creation.
 * - `closed`    — registration is disabled and nothing authorizes it.
 */
export function decideRegistration(input: {
  registrationEnabled: boolean;
  activeUserCount: number;
  inviteValid: boolean;
}): RegistrationMode {
  if (input.registrationEnabled) return 'open';
  if (input.activeUserCount === 0) return 'bootstrap';
  return input.inviteValid ? 'invite' : 'closed';
}

/**
 * An invite authorizes registration ONLY for the exact address it was issued
 * to. Without this, a single bearer invite token could be replayed to create
 * accounts for arbitrary emails while it stays unconsumed. Both sides are
 * already lowercased upstream (createInvite / emailSchema); we normalize again
 * defensively.
 */
export function inviteAuthorizesEmail(inviteEmail: string, registeringEmail: string): boolean {
  return inviteEmail.trim().toLowerCase() === registeringEmail.trim().toLowerCase();
}

// Invite tokens are base64url (generateOpaqueToken), so [A-Za-z0-9_-].
const INVITE_PATH_PATTERN = /^\/accept-invite\/([A-Za-z0-9_-]+)$/;

/**
 * Extract the raw invite token from an internal path like
 * `/accept-invite/<token>` (the shape of the `?next=` param and of
 * AuthToken.redirectTo). Returns null for anything else. The token is only a
 * *candidate* — callers must still validate it against the Invite table.
 */
export function inviteTokenFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = INVITE_PATH_PATTERN.exec(path.split('?')[0] ?? '');
  return match?.[1] ?? null;
}
