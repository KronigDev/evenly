import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Inlined here so the proxy bundle stays free of server-only imports.
const CSRF_COOKIE = 'evenly_csrf';

function edgeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/[+/=]/g, '');
}

/**
 * Ensure every visitor has a CSRF cookie (readable by the client so it can be
 * echoed back in the `x-evenly-csrf` header on mutating requests).
 */
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  if (!request.cookies.get(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, edgeToken(), {
      httpOnly: false,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
    });
  }
  return response;
}

export const config = {
  // Run on pages and API routes, skip static assets and the service worker.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|offline).*)',
  ],
};
