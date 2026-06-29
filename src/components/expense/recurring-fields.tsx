'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurringInput {
  frequency: RecurringFrequency;
  interval: number;
  endDate?: string | null;
}

export interface RecurringFieldsProps {
  value: RecurringInput | null;
  onChange: (value: RecurringInput | null) => void;
}

const FREQUENCIES: RecurringFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

/** "Repeat" toggle revealing frequency, interval and an optional end date. */
export function RecurringFields({ value, onChange }: RecurringFieldsProps) {
  const t = useTranslations('expenses');
  const tc = useTranslations('common');
  const switchId = useId();

  const enabled = value !== null;
  const current: RecurringInput = value ?? { frequency: 'MONTHLY', interval: 1, endDate: null };

  const frequencyLabels: Record<RecurringFrequency, string> = {
    DAILY: t('daily'),
    WEEKLY: t('weekly'),
    MONTHLY: t('monthly'),
  };

  function toggle(checked: boolean) {
    onChange(checked ? { frequency: 'MONTHLY', interval: 1, endDate: null } : null);
  }

  function patch(next: Partial<RecurringInput>) {
    onChange({ ...current, ...next });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={switchId} className="inline-flex cursor-pointer items-center gap-2">
          <ArrowsClockwise size={16} aria-hidden="true" className="text-content-muted" />
          <span className="text-sm font-medium text-content">{t('makeRecurring')}</span>
        </label>
        <Switch
          id={switchId}
          checked={enabled}
          onCheckedChange={toggle}
          aria-label={t('recurring')}
        />
      </div>

      {enabled ? (
        <div className="grid gap-3 rounded-xl border border-hairline bg-surface-2/60 p-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="eyebrow block">{t('frequency')}</span>
            <Select
              value={current.frequency}
              onChange={(event) => patch({ frequency: event.target.value as RecurringFrequency })}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequencyLabels[frequency]}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="eyebrow block">{t('every')}</span>
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={current.interval}
              onChange={(event) => {
                const next = Math.max(1, Math.round(Number(event.target.value) || 1));
                patch({ interval: next });
              }}
              className="tabular font-mono"
            />
          </label>

          <label className="space-y-1.5">
            <span className="eyebrow block">{t('endsOn')}</span>
            <Input
              type="date"
              value={current.endDate ?? ''}
              onChange={(event) => patch({ endDate: event.target.value || null })}
              placeholder={tc('optional')}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
