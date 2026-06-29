'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface RadioGroupItemProps {
  name: string;
  value: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RadioGroupItem({
  name,
  value,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: RadioGroupItemProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'bg-surface shadow-soft ease-smooth flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors duration-150',
        checked ? 'border-brand ring-brand/40 ring-1' : 'border-hairline hover:bg-surface-2',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'border-hairline-strong bg-surface ease-smooth mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-150',
          'peer-checked:border-brand',
          'peer-checked:[&>span]:scale-100 peer-checked:[&>span]:opacity-100',
          'peer-focus-visible:ring-brand/55 peer-focus-visible:ring-offset-surface peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
        )}
      >
        <span className="bg-brand ease-smooth h-2.5 w-2.5 scale-0 rounded-full opacity-0 transition duration-150" />
      </span>
      <span className="min-w-0">
        <span className="text-content block font-medium">{label}</span>
        {description ? (
          <span className="text-content-muted mt-0.5 block text-xs">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  name: string;
  className?: string;
  'aria-label'?: string;
}

export function RadioGroup({
  value,
  onChange,
  options,
  name,
  className,
  'aria-label': ariaLabel,
}: RadioGroupProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-2', className)}>
      {options.map((option) => (
        <RadioGroupItem
          key={option.value}
          name={name}
          value={option.value}
          label={option.label}
          description={option.description}
          checked={option.value === value}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
