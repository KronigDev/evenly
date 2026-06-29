import { APP_URL } from '@/lib/env';

/** Only allow internal redirect targets (defends against open redirects). */
export function safeNext(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path) return fallback;
  if (!path.startsWith('/') || path.startsWith('//')) return fallback;
  return path;
}

export function absoluteUrl(path: string): string {
  return new URL(path, APP_URL).toString();
}
