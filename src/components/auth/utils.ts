/** Shared helpers for the authentication pages. Pure functions, no React. */

/** Minimum password length enforced client-side (mirrors the server schema). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Sanitize a `?next=` redirect target: it must be an app-internal absolute
 * path. Anything else (external URLs, protocol-relative `//host`, empty) falls
 * back to the dashboard so a crafted link can't bounce users off-site.
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/dashboard';
  }
  return raw;
}

/** Lightweight email shape check for client-side validation only. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Append the sanitized `next` target to an auth link, but only when it differs
 * from the default so URLs stay clean for the common case.
 */
export function withNext(path: string, next: string): string {
  if (next === '/dashboard') return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}next=${encodeURIComponent(next)}`;
}
