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
        'flex cursor-pointer items-start gap-3 rounded-lg border bg-surface p-3 text-sm shadow-soft transition-colors duration-150 ease-smooth',
        checked ? 'border-brand ring-1 ring-brand/40' : 'border-hairline hover:bg-surface-2',
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
          'mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-hairline-strong bg-surface transition-colors duration-150 ease-smooth',
          'peer-checked:border-brand',
          'peer-checked:[&>span]:scale-100 peer-checked:[&>span]:opacity-100',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand/55 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
        )}
      >
        <span className="h-2.5 w-2.5 scale-0 rounded-full bg-brand opacity-0 transition duration-150 ease-smooth" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-content">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-content-muted">{description}</span>
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
