import { cn } from '@/lib/utils/cn';

const SIZE_PX = { xs: 14, sm: 16, md: 20, lg: 24 } as const;

export type SpinnerSize = keyof typeof SIZE_PX;

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Accessible label; defaults to a generic loading label. */
  label?: string;
}

/**
 * Circular SVG spinner that inherits `currentColor`. Under reduced-motion the
 * animated ring is hidden and a static dot is shown instead so the indicator
 * never spins for users who opted out of motion.
 */
export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  const px = SIZE_PX[size];
  return (
    <span role="status" aria-label={label} className="inline-flex shrink-0 leading-none">
      <svg
        className={cn('animate-spin text-current motion-reduce:hidden', className)}
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        aria-hidden="true"
        className={cn('hidden rounded-full bg-current motion-reduce:block', className)}
        style={{ width: Math.round(px * 0.45), height: Math.round(px * 0.45) }}
      />
    </span>
  );
}
