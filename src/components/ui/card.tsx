import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle hover lift for clickable cards. */
  interactive?: boolean;
}

export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'surface-card',
        interactive &&
          'ease-smooth hover:shadow-card cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-hairline flex flex-col gap-1 border-b px-5 py-4', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-hairline flex items-center gap-3 border-t px-5 py-4', className)}
      {...props}
    />
  );
}
