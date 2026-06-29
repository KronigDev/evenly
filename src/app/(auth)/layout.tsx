import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { LocaleToggle } from '@/components/ui/locale-toggle';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const t = await getTranslations('common');

  return (
    <div className="bg-canvas relative flex min-h-[100dvh] flex-col">
      {/* Very subtle emerald ambient glow — equal weight in light & dark. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(46rem 28rem at 50% -6%, rgb(var(--c-brand) / 0.06), transparent 70%)',
        }}
      />

      <header className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-2.5">
          <span className="bg-brand text-ink-on shadow-soft flex h-9 w-9 items-center justify-center rounded-xl text-base font-semibold">
            E
          </span>
          <span className="text-content text-[17px] font-semibold tracking-tight">
            {t('appName')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pt-2 pb-16 sm:pb-24">
        <div className="animate-fade-up w-full max-w-[400px]">{children}</div>
      </main>

      <footer className="px-5 pb-8 text-center sm:pb-10">
        <p className="text-2xs text-content-subtle">{t('tagline')}</p>
      </footer>
    </div>
  );
}
