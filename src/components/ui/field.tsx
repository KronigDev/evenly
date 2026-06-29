'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label className={cn('block text-sm font-medium text-content', className)} {...props}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-negative">
          *
        </span>
      ) : null}
    </label>
  );
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Id of the control; also used to derive hint/error ids. */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

type ControlChildProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

function join(...parts: Array<string | null | undefined | false>): string | undefined {
  const value = parts.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}

/**
 * Form field wrapper: label above, hint/error below, wired with
 * `aria-describedby` and `aria-invalid` onto the single control child.
 */
export function Field({ label, hint, error, required, htmlFor, children, className }: FieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = join(error ? errorId : null, hint ? hintId : null);

  let control: ReactNode = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<ControlChildProps>;
    control = cloneElement(child, {
      id: child.props.id ?? controlId,
      'aria-describedby': join(describedBy, child.props['aria-describedby']),
      'aria-invalid': error ? true : child.props['aria-invalid'],
    });
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <Label htmlFor={controlId} required={required}>
          {label}
        </Label>
      ) : null}
      {control}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-content-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
