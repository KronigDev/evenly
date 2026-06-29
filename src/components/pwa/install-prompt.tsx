'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DownloadSimple, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'evenly_install_dismissed';

/** The non-standard event fired by Chromium browsers before the install UI. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes a non-standard flag.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Captures the `beforeinstallprompt` event and offers a subtle, dismissible
 * "Install Evenly" affordance (bottom banner on mobile, small card on desktop).
 * Hidden entirely when already installed/standalone or previously dismissed.
 * Mounted once by the app shell.
 */
export function InstallPrompt() {
  const t = useTranslations('pwa');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onBeforeInstallPrompt = (event: Event) => {
      // Stop Chrome's default mini-infobar; we present our own UI instead.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode / storage disabled — non-fatal */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    setVisible(false);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      /* user closed the native dialog — nothing to do */
    } finally {
      setDeferredPrompt(null);
      // Don't re-nag in this session regardless of the outcome.
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  }, [deferredPrompt]);

  return (
    <AnimatePresence>
      {visible && deferredPrompt ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label={t('installTitle')}
          className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:px-0 sm:pb-0"
        >
          <div className="surface-card mx-auto flex w-full max-w-md items-start gap-3 p-4 shadow-pop sm:w-80">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
            >
              <DownloadSimple weight="regular" className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content">{t('installTitle')}</p>
              <p className="mt-0.5 text-pretty text-xs leading-relaxed text-content-muted">
                {t('installBody')}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={install}>
                  {t('install')}
                </Button>
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  {t('dismiss')}
                </Button>
              </div>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label={t('dismiss')}
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
            >
              <X weight="regular" className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
