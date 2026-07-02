import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { inviteTokenFromPath, registrationAvailability } from '@/lib/auth/registration';
import { AuthCardFallback } from '@/components/auth/auth-card';
import { sanitizeNext, withNext } from '@/components/auth/utils';
import { LoginForm } from './login-form';

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = typeof params.next === 'string' ? params.next : null;
  const mode = await registrationAvailability(inviteTokenFromPath(rawNext));

  // Fresh instance with zero accounts: the first visit must create one.
  if (mode === 'bootstrap') redirect(withNext('/register', sanitizeNext(rawNext)));

  return (
    <Suspense fallback={<AuthCardFallback />}>
      <LoginForm showSignUp={mode !== 'closed'} />
    </Suspense>
  );
}
