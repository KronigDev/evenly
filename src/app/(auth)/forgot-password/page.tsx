'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EnvelopeSimple } from '@phosphor-icons/react';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { AuthCard } from '@/components/auth/auth-card';
import { isValidEmail } from '@/components/auth/utils';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setEmailError(te('invalidEmail'));
      return;
    }
    setEmailError(null);

    setSubmitting(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'RATE_LIMITED') {
        toast.error(te('rateLimited'));
      } else if (error instanceof ApiClientError) {
        toast.error(error.message || te('generic'));
      } else {
        toast.error(te('network'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const backToSignIn = (
    <Link
      href="/login"
      className="text-content hover:text-brand font-medium underline-offset-4 transition-colors hover:underline"
    >
      {t('backToSignIn')}
    </Link>
  );

  if (sent) {
    return (
      <AuthCard
        title={t('checkYourEmail')}
        subtitle={t('passwordResetSentBody', { email: email.trim() })}
        footer={backToSignIn}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="bg-brand/10 text-brand flex h-12 w-12 items-center justify-center rounded-full">
            <EnvelopeSimple size={24} aria-hidden="true" />
          </span>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
          >
            {t('resetPassword')}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t('resetPasswordTitle')}
      subtitle={t('resetPasswordSubtitle')}
      footer={backToSignIn}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('resetPassword')}
        </Button>
      </form>
    </AuthCard>
  );
}
