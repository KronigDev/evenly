'use client';

import { type SelectHTMLAttributes } from 'react';
import { CURRENCIES } from '@/lib/currency';
import { Select } from '@/components/ui/select';

export interface CurrencySelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> {
  value: string;
  onChange: (code: string) => void;
  /** Show only the currency code in the closed state (for tight layouts). */
  compact?: boolean;
}

/** Styled native select over the supported currencies (code + name). */
export function CurrencySelect({ value, onChange, compact = false, ...rest }: CurrencySelectProps) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} {...rest}>
      {CURRENCIES.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {compact ? currency.code : `${currency.code} — ${currency.name}`}
        </option>
      ))}
    </Select>
  );
}
