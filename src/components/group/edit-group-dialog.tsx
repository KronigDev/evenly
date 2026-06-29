'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Check } from '@phosphor-icons/react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api/client';
import { CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/utils/cn';
import type { GroupDTO } from '@/lib/api/types';
import { GROUP_COLORS, groupSwatchClass, type GroupColor } from './queries';

export interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupDTO;
  onSaved?: () => void;
}

interface GroupPatch {
  name?: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  baseCurrency?: string;
  simplifyDebts?: boolean;
}

export function EditGroupDialog({ open, onOpenChange, group, onSaved }: EditGroupDialogProps) {
  const t = useTranslations('groups');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [emoji, setEmoji] = useState(group.emoji ?? '');
  const [color, setColor] = useState<GroupColor>(
    (GROUP_COLORS as readonly string[]).includes(group.color ?? '')
      ? (group.color as GroupColor)
      : 'slate',
  );
  const [baseCurrency, setBaseCurrency] = useState(group.baseCurrency);
  const [simplifyDebts, setSimplifyDebts] = useState(group.simplifyDebts);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setEmoji(group.emoji ?? '');
    setColor(
      (GROUP_COLORS as readonly string[]).includes(group.color ?? '')
        ? (group.color as GroupColor)
        : 'slate',
    );
    setBaseCurrency(group.baseCurrency);
    setSimplifyDebts(group.simplifyDebts);
    setNameError(null);
  }, [open, group]);

  const save = useMutation({
    mutationFn: (patch: GroupPatch) =>
      apiFetch<GroupDTO>(`/api/groups/${group.id}`, { method: 'PATCH', body: patch }),
    onSuccess: async () => {
      toast.success(t('updated'));
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : te('generic')),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(te('required'));
      return;
    }
    setNameError(null);
    save.mutate({
      name: trimmedName,
      description: description.trim() ? description.trim() : null,
      emoji: emoji.trim() ? emoji.trim() : null,
      color,
      baseCurrency,
      simplifyDebts,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!save.isPending}
      aria-label={t('editGroup')}
    >
      <DialogHeader
        title={t('editGroup')}
        onClose={save.isPending ? undefined : () => onOpenChange(false)}
      />
      <form onSubmit={onSubmit}>
        <DialogBody className="space-y-4">
          <Field label={t('groupName')} error={nameError ?? undefined} required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('groupNamePlaceholder')}
              maxLength={80}
              autoFocus
            />
          </Field>

          <Field label={t('description')} hint={tc('optional')}>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('descriptionPlaceholder')}
              maxLength={280}
              rows={2}
            />
          </Field>

          <div className="grid grid-cols-[auto_1fr] items-end gap-3">
            <Field label={t('emoji')}>
              <Input
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="🏠"
                maxLength={4}
                className="w-16 text-center text-lg"
              />
            </Field>
            <Field label={t('baseCurrency')} hint={t('baseCurrencyHint')}>
              <Select
                value={baseCurrency}
                onChange={(event) => setBaseCurrency(event.target.value)}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} — {currency.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-content block text-sm font-medium">{t('color')}</legend>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((option) => {
                const selected = option === color;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-label={option}
                    aria-pressed={selected}
                    onClick={() => setColor(option)}
                    className={cn(
                      'ease-smooth focus-visible:ring-brand/55 grid h-8 w-8 place-items-center rounded-full text-white transition-transform duration-150 outline-none focus-visible:ring-2 active:scale-90',
                      groupSwatchClass(option),
                      selected ? 'ring-content ring-offset-surface ring-2 ring-offset-2' : '',
                    )}
                  >
                    {selected ? <Check size={16} weight="bold" /> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="border-hairline bg-surface-2 flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
            <div className="min-w-0">
              <p className="text-content text-sm font-medium">{t('simplifyDebts')}</p>
              <p className="text-content-muted text-xs">{t('simplifyDebtsHint')}</p>
            </div>
            <Switch
              checked={simplifyDebts}
              onCheckedChange={setSimplifyDebts}
              aria-label={t('simplifyDebts')}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            {tc('cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {tc('saveChanges')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
