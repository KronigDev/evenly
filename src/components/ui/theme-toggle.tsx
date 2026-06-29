'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { IconButton } from './icon-button';

type ThemeChoice = 'light' | 'dark' | 'system';

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const LABEL: Record<ThemeChoice, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render a stable placeholder to avoid a hydration mismatch.
    return (
      <IconButton label="Toggle theme" variant="ghost" disabled className={className}>
        <Sun size={18} />
      </IconButton>
    );
  }

  const current: ThemeChoice =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
  const next = NEXT[current];

  return (
    <IconButton
      label={`${LABEL[current]} — switch to ${LABEL[next].toLowerCase()}`}
      variant="ghost"
      onClick={() => setTheme(next)}
      className={className}
    >
      {current === 'light' ? (
        <Sun size={18} />
      ) : current === 'dark' ? (
        <Moon size={18} />
      ) : (
        <Desktop size={18} />
      )}
    </IconButton>
  );
}
