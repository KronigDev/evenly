import { APP_URL } from '@/lib/env';

export const SESSION_COOKIE = 'evenly_session';
export const CSRF_COOKIE = 'evenly_csrf';
export const CSRF_HEADER = 'x-evenly-csrf';
export const LOCALE_COOKIE = 'evenly_locale';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const MAGIC_LINK_TTL_MS = 1000 * 60 * 30; // 30 minutes
export const EMAIL_VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
export const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

/** Cookies are only marked Secure when the app is served over https. */
export const COOKIE_SECURE = APP_URL.startsWith('https://');
