import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { peekInvite } from '@/lib/invites';
import { AcceptInviteButton } from '@/components/invite/accept-invite-button';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { LocaleToggle } from '@/components/ui/locale-toggle';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface GroupBrief {
  id: string;
  name: string;
  emoji: string | null;
}

async function InviteShell({ children }: { children: ReactNode }) {
  const tc = await getTranslations('common');
  return (
    <div className="bg-canvas relative flex min-h-[100dvh] flex-col">
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
            {tc('appName')}
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
        <p className="text-2xs text-content-subtle">{tc('tagline')}</p>
      </footer>
    </div>
  );
}

function GroupBadge({ group }: { group: GroupBrief }) {
  return (
    <div className="border-hairline bg-surface-2 flex items-center gap-3 rounded-xl border p-3.5">
      <span
        aria-hidden="true"
        className="bg-surface shadow-soft grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl"
      >
        {group.emoji ?? '💸'}
      </span>
      <span className="text-content min-w-0 truncate text-base font-semibold">{group.name}</span>
    </div>
  );
}

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [peek, user] = await Promise.all([peekInvite(token), getCurrentUser()]);

  const t = await getTranslations('invites');
  const tc = await getTranslations('common');
  const ta = await getTranslations('auth');
  const tn = await getTranslations('nav');

  const invitePath = `/accept-invite/${token}`;
  const loginHref = `/login?next=${encodeURIComponent(invitePath)}`;
  const registerHref = `/register?next=${encodeURIComponent(invitePath)}`;

  if (peek.status === 'valid') {
    const inviter = peek.inviterName?.trim();
    const group: GroupBrief = { id: peek.group.id, name: peek.group.name, emoji: peek.group.emoji };
    return (
      <InviteShell>
        <AuthCard
          title={t('acceptInviteTitle')}
          subtitle={inviter ? t('invitedBy', { name: inviter }) : undefined}
        >
          <div className="space-y-5">
            <GroupBadge group={group} />
            {user ? (
              <div className="space-y-3">
                <AcceptInviteButton token={token} groupName={group.name} />
                <p className="text-content-subtle text-center text-xs">
                  {user.email} ·{' '}
                  <Link
                    href={loginHref}
                    className="text-content-muted hover:text-content underline-offset-4 transition-colors hover:underline"
                  >
                    {ta('backToSignIn')}
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button asChild size="lg" fullWidth>
                  <Link href={registerHref}>{t('createAccountToAccept')}</Link>
                </Button>
                <Button asChild variant="secondary" size="lg" fullWidth>
                  <Link href={loginHref}>{t('signInToAccept')}</Link>
                </Button>
              </div>
            )}
          </div>
        </AuthCard>
      </InviteShell>
    );
  }

  if (peek.status === 'accepted') {
    const group: GroupBrief = { id: peek.group.id, name: peek.group.name, emoji: peek.group.emoji };
    return (
      <InviteShell>
        <AuthCard title={t('alreadyMember')}>
          <div className="space-y-5">
            <GroupBadge group={group} />
            {user ? (
              <div className="space-y-3">
                <Button asChild size="lg" fullWidth>
                  <Link href={`/groups/${group.id}`}>{tc('continue')}</Link>
                </Button>
                <Button asChild variant="ghost" size="lg" fullWidth>
                  <Link href="/dashboard">{tn('dashboard')}</Link>
                </Button>
              </div>
            ) : (
              <Button asChild size="lg" fullWidth>
                <Link href={loginHref}>{ta('signIn')}</Link>
              </Button>
            )}
          </div>
        </AuthCard>
      </InviteShell>
    );
  }

  // expired | revoked | invalid
  const message = peek.status === 'expired' ? t('inviteExpired') : t('inviteInvalid');
  return (
    <InviteShell>
      <AuthCard title={message}>
        <Button asChild size="lg" fullWidth>
          <Link href={user ? '/dashboard' : '/login'}>{user ? tn('dashboard') : ta('signIn')}</Link>
        </Button>
      </AuthCard>
    </InviteShell>
  );
}
