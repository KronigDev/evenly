import { cookies } from 'next/headers';
import { Errors } from '@/lib/http';
import { COOKIE_SECURE, CSRF_COOKIE, CSRF_HEADER } from './constants';
import { generateOpaqueToken } from './tokens';

/** Ensure a CSRF cookie exists (readable by JS) and return its value. */
export async function ensureCsrfToken(): Promise<string> {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE)?.value;
  if (!token) {
    token = generateOpaqueToken();
    store.set(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
    });
  }
  return token;
}

export async function getCsrfToken(): Promise<string | undefined> {
  return (await cookies()).get(CSRF_COOKIE)?.value;
}

/**
 * Double-submit CSRF validation for mutating requests: a custom request header
 * must match the CSRF cookie, and any provided Origin must match the host.
 * Cross-origin pages cannot set custom headers or read the cookie.
 */
export async function assertCsrf(request: Request): Promise<void> {
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('host');
    try {
      if (host && new URL(origin).host !== host) {
        throw Errors.forbidden('Cross-origin request rejected.');
      }
    } catch {
      throw Errors.forbidden('Invalid origin.');
    }
  }

  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = (await cookies()).get(CSRF_COOKIE)?.value;
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    throw Errors.forbidden('Invalid or missing CSRF token.');
  }
}
