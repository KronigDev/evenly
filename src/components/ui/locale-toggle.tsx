'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { CaretDown, Check, Translate } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

interface LocaleOption {
  value: string;
  label: string;
  short: string;
}

const LOCALES: LocaleOption[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'de', label: 'Deutsch', short: 'DE' },
];

export function LocaleToggle({ className }: { className?: string }) {
  const activeLocale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const current = LOCALES.find((entry) => entry.value === activeLocale) ?? LOCALES[0]!;

  async function select(locale: string) {
    if (locale === activeLocale || pending) return;
    setPending(true);
    try {
      await apiFetch('/api/me/locale', { method: 'POST', body: { locale } });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className={cn(
          'border-hairline bg-surface text-content shadow-soft hover:bg-surface-2 focus-visible:ring-brand/55 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 disabled:opacity-60',
          className,
        )}
      >
        <Translate size={16} aria-hidden="true" />
        <span>{current.short}</span>
        <CaretDown size={12} weight="bold" aria-hidden="true" className="text-content-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LOCALES.map((entry) => (
          <DropdownMenuItem
            key={entry.value}
            onSelect={() => void select(entry.value)}
            icon={
              <Check
                size={16}
                weight="bold"
                className={cn(entry.value === activeLocale ? 'opacity-100' : 'opacity-0')}
              />
            }
          >
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
