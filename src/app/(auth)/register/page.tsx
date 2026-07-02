import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { inviteTokenFromPath, registrationAvailability } from '@/lib/auth/registration';
import { AuthCard, AuthCardFallback } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { RegisterForm } from './register-form';

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : null;
  // Invite arrivals carry ?next=/accept-invite/<token>; the token is validated
  // server-side — a forged next param does not open the gate.
  const inviteToken = inviteTokenFromPath(next);
  const mode = await registrationAvailability(inviteToken);

  if (mode === 'closed') {
    const t = await getTranslations('auth');
    return (
      <AuthCard title={t('signUpDisabledTitle')} subtitle={t('signUpDisabledBody')}>
        <Button asChild size="lg" fullWidth>
          <Link href="/login">{t('signIn')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <Suspense fallback={<AuthCardFallback />}>
      <RegisterForm inviteToken={inviteToken ?? undefined} />
    </Suspense>
  );
}
