'use client';

import { forwardRef, useState, type FocusEvent, type InputHTMLAttributes } from 'react';
import { currencyMeta } from '@/lib/currency';
import { formatAmount, parseMoneyInput } from '@/lib/money';
import { cn } from '@/lib/utils/cn';
import { CurrencySelect } from './currency-select';

type NativeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'defaultValue' | 'size'
>;

export interface AmountInputProps extends NativeInputProps {
  /** Current amount in integer minor units of `currency`. */
  valueMinor: number;
  /** Called with the parsed amount in integer minor units (0 when empty). */
  onChangeMinor: (minor: number) => void;
  currency: string;
  /** Permit negative entry (used by the adjustment editor). */
  allowNegative?: boolean;
  /** Hide the leading currency symbol adornment. */
  hideSymbol?: boolean;
  size?: 'md' | 'lg';
  containerClassName?: string;
  invalid?: boolean;
}

const sizeClass = {
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
} as const;

/**
 * Money text input bound to integer minor units. Parses free-form text via
 * `parseMoneyInput` (respecting the currency's decimals), shows the currency
 * symbol, selects all on focus, and reformats on blur. forwardRef-friendly.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  {
    valueMinor,
    onChangeMinor,
    currency,
    allowNegative = false,
    hideSymbol = false,
    size = 'md',
    className,
    containerClassName,
    invalid = false,
    readOnly,
    disabled,
    placeholder,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');

  const symbol = currencyMeta(currency)?.symbol ?? currency.toUpperCase();
  const formatted = valueMinor === 0 ? '' : formatAmount(valueMinor, currency);
  const display = focused && !readOnly ? text : formatted;

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setText(formatted);
    setFocused(true);
    event.currentTarget.select();
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    onBlur?.(event);
  }

  function handleChange(raw: string) {
    setText(raw);
    let parsed = parseMoneyInput(raw, currency);
    if (parsed === null) parsed = 0;
    if (!allowNegative && parsed < 0) parsed = -parsed;
    onChangeMinor(parsed);
  }

  return (
    <div
      className={cn(
        'border-hairline bg-surface shadow-soft ease-smooth flex items-center overflow-hidden rounded-lg border transition-[border-color,box-shadow] duration-150',
        'focus-within:border-brand focus-within:ring-brand/30 focus-within:ring-2',
        invalid && 'border-negative focus-within:border-negative focus-within:ring-negative/30',
        (disabled || readOnly) && 'opacity-90',
        sizeClass[size],
        containerClassName,
      )}
    >
      {hideSymbol ? null : (
        <span className="tabular text-content-subtle pr-1 pl-3 font-mono text-xs select-none">
          {symbol}
        </span>
      )}
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder ?? formatAmount(0, currency)}
        aria-invalid={invalid || undefined}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          'tabular text-content placeholder:text-content-subtle h-full w-full min-w-0 bg-transparent text-right font-mono outline-none',
          hideSymbol ? 'px-3' : 'pr-3 pl-1',
          readOnly && 'cursor-default',
          className,
        )}
        {...props}
      />
    </div>
  );
});

export interface CurrencyAmountInputProps {
  valueMinor: number;
  onChangeMinor: (minor: number) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  /** When true the amount is derived (e.g. itemized total) and not editable. */
  readOnly?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-describedby'?: string;
}

/** The main total: a large amount field paired with a currency selector. */
export function CurrencyAmountInput({
  valueMinor,
  onChangeMinor,
  currency,
  onCurrencyChange,
  readOnly = false,
  autoFocus = false,
  invalid = false,
  id,
  'aria-describedby': describedBy,
}: CurrencyAmountInputProps) {
  return (
    <div className="flex items-stretch gap-2">
      <AmountInput
        id={id}
        size="lg"
        valueMinor={valueMinor}
        onChangeMinor={onChangeMinor}
        currency={currency}
        readOnly={readOnly}
        autoFocus={autoFocus}
        invalid={invalid}
        aria-describedby={describedBy}
        containerClassName="flex-1"
        className="text-left text-lg font-semibold"
      />
      <CurrencySelect
        value={currency}
        onChange={onCurrencyChange}
        compact
        aria-label="Currency"
        className="h-12 w-28 shrink-0"
      />
    </div>
  );
}
