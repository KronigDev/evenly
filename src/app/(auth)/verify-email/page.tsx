'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EnvelopeSimple } from '@phosphor-icons/react';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { AuthCard, AuthCardFallback } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface ResendResult {
  sent?: boolean;
  alreadyVerified?: boolean;
}

function VerifyEmailContent() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const params = useSearchParams();
  const { toast } = useToast();

  const errorParam = params.get('error');
  const email = params.get('email');

  const [submitting, setSubmitting] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const noticeShown = useRef(false);
  useEffect(() => {
    if (noticeShown.current || !errorParam) return;
    noticeShown.current = true;
    toast.error(errorParam === 'expired' ? t('linkExpired') : t('linkInvalid'));
  }, [errorParam, toast, t]);

  async function onResend() {
    setSubmitting(true);
    setNeedsSignIn(false);
    try {
      const result = await apiFetch<ResendResult>('/api/auth/resend-verification', {
        method: 'POST',
      });
      if (result?.alreadyVerified) {
        toast.success(t('emailVerified'));
      } else {
        toast.success(t('verifyEmailSent'));
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        // Not signed in (the common case here) — guide them to sign in instead.
        setNeedsSignIn(true);
        toast.error(te('unauthorized'));
      } else if (error instanceof ApiClientError && error.code === 'RATE_LIMITED') {
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

  return (
    <AuthCard
      title={t('verifyEmailTitle')}
      subtitle={email ? t('verifyEmailBody', { email }) : t('checkYourEmail')}
      footer={
        <Link
          href="/dashboard"
          className="text-content hover:text-brand font-medium underline-offset-4 transition-colors hover:underline"
        >
          {te('goHome')}
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="bg-brand/10 text-brand flex h-12 w-12 items-center justify-center rounded-full">
          <EnvelopeSimple size={24} aria-hidden="true" />
        </span>

        {errorParam ? (
          <p
            role="alert"
            className="border-negative/30 bg-negative/10 text-negative w-full rounded-lg border px-3 py-2 text-sm"
          >
            {errorParam === 'expired' ? t('linkExpired') : t('linkInvalid')}
          </p>
        ) : null}

        <Button size="lg" fullWidth loading={submitting} onClick={onResend}>
          {t('resendVerification')}
        </Button>

        {needsSignIn ? (
          <p className="text-content-muted text-sm">
            <Link
              href="/login"
              className="text-content hover:text-brand font-medium underline-offset-4 transition-colors hover:underline"
            >
              {t('signIn')}
            </Link>
          </p>
        ) : null}
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthCardFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
