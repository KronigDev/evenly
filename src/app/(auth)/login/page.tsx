'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { AuthCard, AuthCardFallback } from '@/components/auth/auth-card';
import { PasswordInput } from '@/components/auth/password-input';
import { isValidEmail, sanitizeNext, withNext } from '@/components/auth/utils';
import { Button } from '@/components/ui/button';
import { Field, Label } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function LoginForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const next = sanitizeNext(params.get('next'));
  const verified = params.get('verified') === '1';
  const errorParam = params.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Surface the outcome of an email-verification link exactly once.
  const noticeShown = useRef(false);
  useEffect(() => {
    if (noticeShown.current) return;
    if (verified) {
      noticeShown.current = true;
      toast.success(t('emailVerified'));
    } else if (errorParam === 'verify') {
      noticeShown.current = true;
      toast.error(t('linkInvalid'));
    }
  }, [verified, errorParam, toast, t]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    let valid = true;
    if (!isValidEmail(email)) {
      setEmailError(te('invalidEmail'));
      valid = false;
    } else {
      setEmailError(null);
    }
    if (password.length === 0) {
      setPasswordError(te('required'));
      valid = false;
    } else {
      setPasswordError(null);
    }
    if (!valid) return;

    setSubmitting(true);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          setFormError(t('invalidCredentials'));
          toast.error(t('invalidCredentials'));
        } else if (error.code === 'RATE_LIMITED') {
          toast.error(te('rateLimited'));
        } else {
          toast.error(error.message || te('generic'));
        }
      } else {
        toast.error(te('network'));
      }
    }
  }

  return (
    <AuthCard
      title={t('signInTitle')}
      subtitle={t('signInSubtitle')}
      footer={
        <span>
          {t('noAccount')}{' '}
          <Link
            href={withNext('/register', next)}
            className="text-content hover:text-brand font-medium underline-offset-4 transition-colors hover:underline"
          >
            {t('signUp')}
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? (
          <p
            role="alert"
            className="border-negative/30 bg-negative/10 text-negative rounded-lg border px-3 py-2 text-sm"
          >
            {formError}
          </p>
        ) : null}

        <Field label={t('emailLabel')} error={emailError}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="login-password">{t('passwordLabel')}</Label>
            <Link
              href={withNext('/forgot-password', next)}
              className="text-content-muted hover:text-content text-xs font-medium underline-offset-4 transition-colors hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'login-password-error' : undefined}
          />
          {passwordError ? (
            <p id="login-password-error" className="text-negative text-xs">
              {passwordError}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? t('signingIn') : t('signIn')}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="bg-hairline h-px flex-1" />
        <span className="text-2xs tracking-eyebrow text-content-subtle font-medium uppercase">
          {tc('or')}
        </span>
        <span className="bg-hairline h-px flex-1" />
      </div>

      <Button asChild variant="secondary" size="lg" fullWidth>
        <Link href={withNext('/magic-link', next)}>{t('useMagicLink')}</Link>
      </Button>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <LoginForm />
    </Suspense>
  );
}
