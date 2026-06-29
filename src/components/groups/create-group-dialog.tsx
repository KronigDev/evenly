'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import type { GroupDTO } from '@/lib/api/types';
import { CURRENCIES, CURRENCY_CODES } from '@/lib/currency';
import { cn } from '@/lib/utils/cn';
import { useUser } from '@/components/app/user-context';
import { GROUP_COLORS } from '@/components/app/group-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Label } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

/** A small, friendly preset of group emoji. */
const PRESET_EMOJI = ['🏠', '✈️', '🍽️', '🎉', '🏖️', '🚗', '💡', '🛒', '🎬', '⚽', '🎁', '☕'];

const DEFAULT_COLOR = GROUP_COLORS[0]?.key ?? 'emerald';

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateGroupBody {
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  baseCurrency: string;
  simplifyDebts: boolean;
}

/** Controlled dialog to create a new standard group. */
export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useUser();

  const initialCurrency = CURRENCY_CODES.includes(user.defaultCurrency)
    ? user.defaultCurrency
    : 'EUR';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [currency, setCurrency] = useState(initialCurrency);
  const [simplify, setSimplify] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  function reset() {
    setName('');
    setDescription('');
    setEmoji(null);
    setColor(DEFAULT_COLOR);
    setCurrency(initialCurrency);
    setSimplify(true);
    setNameError(null);
  }

  const mutation = useMutation({
    mutationFn: (body: CreateGroupBody) =>
      apiFetch<GroupDTO>('/api/groups', { method: 'POST', body }),
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(group.name);
      onOpenChange(false);
      reset();
      router.push(`/groups/${group.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : te('generic'));
    },
  });

  function close() {
    if (mutation.isPending) return;
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(te('required'));
      return;
    }
    setNameError(null);
    const trimmedDescription = description.trim();
    mutation.mutate({
      name: trimmed,
      description: trimmedDescription ? trimmedDescription : undefined,
      emoji: emoji ?? undefined,
      color,
      baseCurrency: currency,
      simplifyDebts: simplify,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!mutation.isPending}
      aria-label={t('createGroup')}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader title={t('createGroup')} onClose={close} />

        <DialogBody className="space-y-5">
          <Field label={t('groupName')} required error={nameError}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('groupNamePlaceholder')}
              maxLength={80}
              autoFocus
              required
            />
          </Field>

          <Field label={`${t('description')} (${tc('optional')})`}>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('descriptionPlaceholder')}
              maxLength={500}
              rows={2}
            />
          </Field>

          <div className="space-y-1.5">
            <Label>{t('emoji')}</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_EMOJI.map((value) => {
                const active = emoji === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    aria-label={value}
                    onClick={() => setEmoji(active ? null : value)}
                    className={cn(
                      'grid h-10 w-10 place-items-center rounded-lg border text-lg leading-none outline-none transition-colors duration-150 ease-smooth focus-visible:ring-2 focus-visible:ring-brand/55',
                      active
                        ? 'border-brand bg-brand/10 ring-2 ring-brand/40'
                        : 'border-hairline bg-surface-2 hover:bg-surface-3',
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('color')}</Label>
            <div className="flex flex-wrap gap-2.5">
              {GROUP_COLORS.map((option) => {
                const active = color === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={active}
                    aria-label={option.key}
                    onClick={() => setColor(option.key)}
                    className={cn(
                      'h-8 w-8 rounded-full outline-none ring-2 ring-offset-2 ring-offset-surface transition-shadow duration-150 ease-smooth focus-visible:ring-brand/70',
                      option.swatch,
                      active ? 'ring-content/60' : 'ring-transparent hover:ring-hairline-strong',
                    )}
                  />
                );
              })}
            </div>
          </div>

          <Field label={t('baseCurrency')} hint={t('baseCurrencyHint')}>
            <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-hairline bg-surface-2 p-3.5">
            <div className="min-w-0">
              <Label htmlFor="create-group-simplify">{t('simplifyDebts')}</Label>
              <p className="mt-0.5 text-xs text-content-muted">{t('simplifyDebtsHint')}</p>
            </div>
            <Switch
              id="create-group-simplify"
              checked={simplify}
              onCheckedChange={setSimplify}
              aria-label={t('simplifyDebts')}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {t('createGroup')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
