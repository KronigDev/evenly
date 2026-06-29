import type { Metadata } from 'next';
import { WifiSlash } from '@phosphor-icons/react/dist/ssr';
import { getTranslations } from 'next-intl/server';
import { RetryButton } from './retry-button';

export const metadata: Metadata = {
  title: 'Offline — Evenly',
  robots: { index: false, follow: false },
};

/**
 * Offline fallback served by the service worker when a navigation fails with no
 * network. Pure server component — no data fetching — so it renders from cache.
 */
export default async function OfflinePage() {
  const t = await getTranslations('pwa');
  const tCommon = await getTranslations('common');

  return (
    <main className="bg-canvas flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="surface-card animate-fade-up flex w-full max-w-sm flex-col items-center gap-5 px-7 py-9 text-center">
        <span
          aria-hidden="true"
          className="border-hairline bg-surface-2 text-content-muted flex h-16 w-16 items-center justify-center rounded-full border"
        >
          <WifiSlash weight="regular" className="h-8 w-8" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-content text-lg font-semibold">{t('offline')}</h1>
          <p className="text-content-muted text-sm leading-relaxed text-pretty">
            {t('offlineBody')}
          </p>
        </div>

        <RetryButton label={tCommon('retry')} />
      </div>
    </main>
  );
}
