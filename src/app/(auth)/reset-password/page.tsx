'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { AuthCard, AuthCardFallback } from '@/components/auth/auth-card';
import { PasswordInput } from '@/components/auth/password-input';
import { MIN_PASSWORD_LENGTH } from '@/components/auth/utils';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invalid, setInvalid] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    let valid = true;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('passwordRequirements'));
      valid = false;
    } else {
      setPasswordError(null);
    }
    if (confirm !== password) {
      setConfirmError(t('passwordsDontMatch'));
      valid = false;
    } else {
      setConfirmError(null);
    }
    if (!valid) return;

    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      toast.success(t('passwordChanged'));
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError && error.status === 400) {
        setInvalid(true);
      } else if (error instanceof ApiClientError && error.code === 'RATE_LIMITED') {
        toast.error(te('rateLimited'));
      } else if (error instanceof ApiClientError) {
        toast.error(error.message || te('generic'));
      } else {
        toast.error(te('network'));
      }
    }
  }

  const backToSignIn = (
    <Link
      href="/login"
      className="font-medium text-content underline-offset-4 transition-colors hover:text-brand hover:underline"
    >
      {t('backToSignIn')}
    </Link>
  );

  if (!token || invalid) {
    return (
      <AuthCard
        title={t('linkExpired')}
        subtitle={t('resetPasswordSubtitle')}
        footer={backToSignIn}
      >
        <Button asChild size="lg" fullWidth>
          <Link href="/forgot-password">{t('resetPassword')}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('setNewPassword')}
      subtitle={t('passwordRequirements')}
      footer={backToSignIn}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label={t('newPassword')} error={passwordError}>
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            required
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field label={t('confirmPassword')} error={confirmError}>
          <PasswordInput
            autoComplete="new-password"
            required
            placeholder="••••••••"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('resetPassword')}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
