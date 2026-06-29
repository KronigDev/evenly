import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'de'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
const LOCALE_COOKIE = 'evenly_locale';

export function resolveLocale(value: string | undefined): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  const messages = (await import(`./messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Tolerate missing keys: log nothing for MISSING_MESSAGE and humanize the key.
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') return;
      console.error(error);
    },
    getMessageFallback({ key }) {
      const last = key.split('.').pop() ?? key;
      return last
        .replace(/[._-]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
    },
  };
});
