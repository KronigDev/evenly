'use client';

import { ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

/**
 * Reloads the current route. When the connection is back, the navigation
 * succeeds and the real page replaces this offline fallback.
 */
export function RetryButton({ label }: { label: string }) {
  return (
    <Button
      variant="primary"
      size="md"
      leftIcon={<ArrowClockwise weight="regular" className="h-4 w-4" />}
      onClick={() => location.reload()}
    >
      {label}
    </Button>
  );
}
