'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EnvelopeSimple } from '@phosphor-icons/react';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { AuthCard, AuthCardFallback } from '@/components/auth/auth-card';
import { isValidEmail, sanitizeNext, withNext } from '@/components/auth/utils';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

function MagicLinkForm() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const params = useSearchParams();
  const { toast } = useToast();

  const next = sanitizeNext(params.get('next'));
  const errorParam = params.get('error');
  const linkError = errorParam === 'invalid';
  // Consume refused to create an account (registration disabled, no invite).
  const disabledError = errorParam === 'disabled';

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const noticeShown = useRef(false);
  useEffect(() => {
    if (noticeShown.current || (!linkError && !disabledError)) return;
    noticeShown.current = true;
    toast.error(linkError ? t('linkInvalid') : t('magicLinkNoAccount'));
  }, [linkError, disabledError, toast, t]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setEmailError(te('invalidEmail'));
      return;
    }
    setEmailError(null);

    const trimmed = email.trim();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/magic-link', {
        method: 'POST',
        body: { email: trimmed, redirectTo: next },
      });
      setSentEmail(trimmed);
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

  const passwordSignIn = (
    <Link
      href={withNext('/login', next)}
      className="text-content hover:text-brand font-medium underline-offset-4 transition-colors hover:underline"
    >
      {t('usePassword')}
    </Link>
  );

  if (sent) {
    return (
      <AuthCard
        title={t('magicLinkSent')}
        subtitle={t('magicLinkSentBody')}
        footer={passwordSignIn}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="bg-brand/10 text-brand flex h-12 w-12 items-center justify-center rounded-full">
            <EnvelopeSimple size={24} aria-hidden="true" />
          </span>
          <p className="text-content text-sm">
            <span className="font-medium">{sentEmail}</span>
          </p>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
          >
            {t('sendMagicLink')}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('magicLinkTitle')} subtitle={t('magicLinkSubtitle')} footer={passwordSignIn}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {linkError || disabledError ? (
          <p
            role="alert"
            className="border-negative/30 bg-negative/10 text-negative rounded-lg border px-3 py-2 text-sm"
          >
            {linkError ? t('linkInvalid') : t('magicLinkNoAccount')}
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

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {t('sendMagicLink')}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <MagicLinkForm />
    </Suspense>
  );
}
