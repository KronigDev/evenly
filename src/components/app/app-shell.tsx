'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Bell,
  CaretUpDown,
  ChartLineUp,
  ClockCounterClockwise,
  Desktop,
  Gear,
  House,
  Moon,
  Plus,
  SignOut,
  Sun,
  UserCircle,
  UsersThree,
  WarningCircle,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { apiFetch } from '@/lib/api/client';
import type { UserDTO } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useToast } from '@/components/ui/toast';
import { UserProvider, useUser } from './user-context';

const ADD_EXPENSE_HREF = '/expenses/new';

interface NavEntry {
  key: string;
  href: string;
  Icon: Icon;
}

const PRIMARY_NAV: NavEntry[] = [
  { key: 'dashboard', href: '/dashboard', Icon: House },
  { key: 'groups', href: '/groups', Icon: UsersThree },
  { key: 'friends', href: '/friends', Icon: UserCircle },
  { key: 'activity', href: '/activity', Icon: ClockCounterClockwise },
  { key: 'statistics', href: '/stats', Icon: ChartLineUp },
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Emerald "E" tile + wordmark. */
function Wordmark() {
  const t = useTranslations('common');
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/55"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-base font-semibold text-ink-on shadow-soft">
        E
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-content">{t('appName')}</span>
    </Link>
  );
}

/** Bell linking to notifications, with an unread dot driven by react-query. */
function NotificationsBell() {
  const t = useTranslations('nav');
  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: ({ signal }) => apiFetch<{ unreadCount: number }>('/api/notifications', { signal }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unread = data?.unreadCount ?? 0;

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `${t('notifications')} (${unread})` : t('notifications')}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-content outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand/55"
    >
      <Bell size={20} />
      {unread > 0 ? (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-surface" />
      ) : null}
    </Link>
  );
}

/** Theme selector embedded in the user menu (light / dark / system). */
function ThemeChoices() {
  const t = useTranslations('settings');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value =
    mounted && (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'system';

  const options: { value: string; label: string; icon: ReactNode }[] = [
    { value: 'light', label: t('light'), icon: <Sun size={15} /> },
    { value: 'dark', label: t('dark'), icon: <Moon size={15} /> },
    { value: 'system', label: t('system'), icon: <Desktop size={15} /> },
  ];

  return (
    <div className="px-1.5 py-1">
      <p className="eyebrow px-1 pb-1.5">{t('theme')}</p>
      <div className="grid grid-cols-3 gap-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              aria-label={option.label}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex h-8 items-center justify-center rounded-md border outline-none transition-colors duration-150 ease-smooth focus-visible:ring-2 focus-visible:ring-brand/55',
                active
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-hairline bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content',
              )}
            >
              {option.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Language selector embedded in the user menu (persists via /api/me/locale). */
function LanguageChoices() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const options = [
    { value: 'en', label: 'EN' },
    { value: 'de', label: 'DE' },
  ];

  async function select(next: string) {
    if (next === locale || pending) return;
    setPending(true);
    try {
      await apiFetch('/api/me/locale', { method: 'POST', body: { locale: next } });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-1.5 py-1">
      <p className="eyebrow px-1 pb-1.5">{t('language')}</p>
      <div className="grid grid-cols-2 gap-1">
        {options.map((option) => {
          const active = locale === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => void select(option.value)}
              className={cn(
                'flex h-8 items-center justify-center rounded-md border text-xs font-medium outline-none transition-colors duration-150 ease-smooth focus-visible:ring-2 focus-visible:ring-brand/55 disabled:opacity-60',
                active
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-hairline bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Desktop user menu in the sidebar footer. Opens upward. */
function UserMenu() {
  const t = useTranslations('common');
  const router = useRouter();
  const { user } = useUser();

  async function signOut() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* sign out regardless of the network result */
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-[14.5rem] max-w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand/55">
        <Avatar name={user.name} image={user.image} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-content">{user.name}</span>
          <span className="block truncate text-xs text-content-muted">{user.email}</span>
        </span>
        <CaretUpDown size={16} aria-hidden="true" className="shrink-0 text-content-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bottom-full top-auto mb-2 mt-0 w-[15rem] origin-bottom"
      >
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-content">{user.name}</p>
          <p className="truncate text-xs text-content-muted">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Gear size={16} />} onSelect={() => router.push('/settings')}>
          {t('settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeChoices />
        <LanguageChoices />
        <DropdownMenuSeparator />
        <DropdownMenuItem danger icon={<SignOut size={16} />} onSelect={() => void signOut()}>
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fixed left sidebar (lg+). */
function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-hairline bg-surface lg:flex">
      <div className="flex h-16 items-center justify-between px-5">
        <Wordmark />
        <NotificationsBell />
      </div>

      <div className="px-3 pb-2">
        <Button asChild fullWidth>
          <Link href={ADD_EXPENSE_HREF}>
            <Plus size={18} weight="bold" aria-hidden="true" />
            {t('addExpense')}
          </Link>
        </Button>
      </div>

      <nav aria-label={t('menu')} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {PRIMARY_NAV.map(({ key, href, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors duration-150 ease-smooth focus-visible:ring-2 focus-visible:ring-brand/55',
                active
                  ? 'bg-surface-2 text-content'
                  : 'text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              <Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
              {t(key)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline p-3">
        <UserMenu />
      </div>
    </aside>
  );
}

/** Mobile top bar (< lg): wordmark + notifications + theme. */
function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hairline bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
      <Wordmark />
      <div className="flex items-center gap-0.5">
        <NotificationsBell />
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Mobile bottom tab bar (< lg) with an emphasized center "Add". */
function MobileTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const left: NavEntry[] = [
    { key: 'dashboard', href: '/dashboard', Icon: House },
    { key: 'groups', href: '/groups', Icon: UsersThree },
  ];
  const right: NavEntry[] = [
    { key: 'activity', href: '/activity', Icon: ClockCounterClockwise },
    { key: 'settings', href: '/settings', Icon: Gear },
  ];

  function tab({ key, href, Icon }: NavEntry) {
    const active = isActivePath(pathname, href);
    return (
      <Link
        key={key}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand/55',
          active ? 'text-content' : 'text-content-subtle hover:text-content',
        )}
      >
        <Icon size={22} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
        <span>{t(key)}</span>
      </Link>
    );
  }

  return (
    <nav
      aria-label={t('menu')}
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      {left.map(tab)}
      <Link
        href={ADD_EXPENSE_HREF}
        aria-label={t('addExpense')}
        className="flex flex-1 items-center justify-center outline-none"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-ink-on shadow-soft transition-transform active:scale-95">
          <Plus size={22} weight="bold" aria-hidden="true" />
        </span>
      </Link>
      {right.map(tab)}
    </nav>
  );
}

/** Dismissible banner prompting unverified users to verify their email. */
function VerifyEmailBanner() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const { user } = useUser();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (user.emailVerified || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      await apiFetch('/api/auth/resend-verification', { method: 'POST' });
      toast.success(t('verifyEmailSent'));
    } catch {
      toast.error(te('generic'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <WarningCircle
          size={18}
          weight="fill"
          aria-hidden="true"
          className="shrink-0 text-warning"
        />
        <p className="min-w-0 flex-1 text-sm text-content">{t('verifyEmailTitle')}</p>
        <Button size="sm" variant="secondary" loading={sending} onClick={() => void resend()}>
          {t('resendVerification')}
        </Button>
        <IconButton
          label={tc('close')}
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="-mr-1.5 shrink-0"
        >
          <X size={16} />
        </IconButton>
      </div>
    </div>
  );
}

export interface AppShellProps {
  user: UserDTO;
  children: ReactNode;
}

/** Authenticated app frame: sidebar (desktop) + top/bottom bars (mobile). */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <UserProvider user={user}>
      <div className="min-h-[100dvh] bg-canvas">
        <Sidebar />

        <div className="flex min-h-[100dvh] flex-col lg:pl-64">
          <MobileTopBar />
          <VerifyEmailBanner />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
            {children}
          </main>
        </div>

        <MobileTabBar />
        <InstallPrompt />
      </div>
    </UserProvider>
  );
}
