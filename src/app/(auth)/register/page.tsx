'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { AuthCard, AuthCardFallback } from '@/components/auth/auth-card';
import { PasswordInput } from '@/components/auth/password-input';
import { MIN_PASSWORD_LENGTH, isValidEmail, sanitizeNext, withNext } from '@/components/auth/utils';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function RegisterForm() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const { toast } = useToast();

  const next = sanitizeNext(params.get('next'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let valid = true;
    if (name.trim().length === 0) {
      setNameError(te('required'));
      valid = false;
    } else {
      setNameError(null);
    }
    if (!isValidEmail(email)) {
      setEmailError(te('invalidEmail'));
      valid = false;
    } else {
      setEmailError(null);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('passwordRequirements'));
      valid = false;
    } else {
      setPasswordError(null);
    }
    if (!valid) return;

    setSubmitting(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          password,
          locale: locale === 'de' ? 'de' : 'en',
        },
      });
      router.replace(next);
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        if (error.code === 'CONFLICT') {
          setEmailError(t('emailInUse'));
          toast.error(t('emailInUse'));
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
      title={t('signUpTitle')}
      subtitle={t('signUpSubtitle')}
      footer={
        <span>
          {t('alreadyHaveAccount')}{' '}
          <Link
            href={withNext('/login', next)}
            className="font-medium text-content underline-offset-4 transition-colors hover:text-brand hover:underline"
          >
            {t('signIn')}
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t('nameLabel')} error={nameError}>
          <Input
            type="text"
            autoComplete="name"
            autoFocus
            required
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label={t('emailLabel')} error={emailError}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label={t('passwordLabel')} hint={t('passwordRequirements')} error={passwordError}>
          <PasswordInput
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? t('creatingAccount') : t('createAccount')}
        </Button>

        <p className="text-pretty text-center text-xs text-content-subtle">{t('termsNotice')}</p>
      </form>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
