import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/** Loading placeholder using the `.skeleton` shimmer helper from globals.css. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton h-4 w-full', className)} {...props} />;
}
