'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { At, User } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import { CURRENCIES, CURRENCY_CODES } from '@/lib/currency';
import { useUser } from '@/components/app/user-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

type AddMode = 'email' | 'name';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AddFriendBody {
  email?: string;
  name?: string;
  baseCurrency: string;
}

/** Controlled dialog to start a 1:1 balance with a friend (by email or name). */
export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const t = useTranslations('friends');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();

  const initialCurrency = CURRENCY_CODES.includes(user.defaultCurrency)
    ? user.defaultCurrency
    : 'EUR';

  const [mode, setMode] = useState<AddMode>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(initialCurrency);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode('email');
    setEmail('');
    setName('');
    setCurrency(initialCurrency);
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: (body: AddFriendBody) =>
      apiFetch<{ groupId: string }>('/api/friends', { method: 'POST', body }),
    onSuccess: ({ groupId }, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(variables.name ?? variables.email ?? t('addFriend'));
      onOpenChange(false);
      reset();
      router.push(`/groups/${groupId}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : te('generic'));
    },
  });

  function close() {
    if (mutation.isPending) return;
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'email') {
      const trimmed = email.trim();
      if (!EMAIL_RE.test(trimmed)) {
        setError(te('invalidEmail'));
        return;
      }
      setError(null);
      mutation.mutate({ email: trimmed, baseCurrency: currency });
    } else {
      const trimmed = name.trim();
      if (!trimmed) {
        setError(te('required'));
        return;
      }
      setError(null);
      mutation.mutate({ name: trimmed, baseCurrency: currency });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!mutation.isPending}
      aria-label={t('addFriend')}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader title={t('addFriend')} description={t('noFriendsBody')} onClose={close} />

        <DialogBody className="space-y-5">
          <SegmentedControl<AddMode>
            aria-label={t('addFriend')}
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError(null);
            }}
            options={[
              { value: 'email', label: t('addByEmail'), icon: <At size={15} /> },
              { value: 'name', label: tc('name'), icon: <User size={15} /> },
            ]}
            className="w-full"
          />

          {mode === 'email' ? (
            <Field label={t('friendEmail')} required error={error}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
                autoFocus
                required
              />
            </Field>
          ) : (
            <Field label={t('newFriendName')} required error={error}>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('namePlaceholder')}
                maxLength={80}
                autoFocus
                required
              />
            </Field>
          )}

          <Field label={tc('currency')}>
            <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.name}
                </option>
              ))}
            </Select>
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {t('addFriend')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
