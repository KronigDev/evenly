import { env } from '@/lib/env';
import { prisma } from '@/lib/db';
import { peekInvite } from '@/lib/invites';
import {
  decideRegistration,
  inviteAuthorizesEmail,
  type RegistrationMode,
} from '@/lib/auth/registration-policy';

export { inviteTokenFromPath, type RegistrationMode } from '@/lib/auth/registration-policy';

function activeUserCount(): Promise<number> {
  return prisma.user.count({ where: { deletedAt: null } });
}

/**
 * UI-level availability (email-agnostic): decides whether the registration form
 * should be shown at all. A structurally valid invite token opens the form; the
 * authoritative, email-bound check runs server-side in {@link registrationMode}.
 * Never rely on this to authorize account creation.
 */
export async function registrationAvailability(
  inviteToken?: string | null,
): Promise<RegistrationMode> {
  if (env.REGISTRATION_ENABLED) return 'open';
  const count = await activeUserCount();
  const inviteValid =
    count > 0 && inviteToken ? (await peekInvite(inviteToken)).status === 'valid' : false;
  return decideRegistration({ registrationEnabled: false, activeUserCount: count, inviteValid });
}

/**
 * Authoritative server-side registration gate. Unlike
 * {@link registrationAvailability}, the invite must have been issued to *this*
 * email — so a single bearer invite token cannot be replayed to create accounts
 * for arbitrary addresses. Soft-deleted users do not count towards bootstrap,
 * matching the register route's re-registration rule.
 */
export async function registrationMode(input: {
  email: string;
  inviteToken?: string | null;
}): Promise<RegistrationMode> {
  if (env.REGISTRATION_ENABLED) return 'open';
  const count = await activeUserCount();
  let inviteValid = false;
  if (count > 0 && input.inviteToken) {
    const peek = await peekInvite(input.inviteToken);
    inviteValid = peek.status === 'valid' && inviteAuthorizesEmail(peek.email, input.email);
  }
  return decideRegistration({ registrationEnabled: false, activeUserCount: count, inviteValid });
}
