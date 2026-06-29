'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api/client';
import { useToast } from '@/components/ui/toast';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  danger?: boolean;
  /** Runs on confirm; the dialog closes when it resolves. */
  onConfirm: () => Promise<void> | void;
}

/** Reusable confirmation dialog used for destructive group actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const te = useTranslations('errors');
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message || te('generic'));
      } else {
        toast.error(te('network'));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!pending}
      aria-label={String(title)}
    >
      <DialogHeader title={title} onClose={pending ? undefined : () => onOpenChange(false)} />
      {description ? (
        <DialogBody>
          <p className="text-content-muted text-sm text-pretty">{description}</p>
        </DialogBody>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          {cancelLabel ?? t('cancel')}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={pending} onClick={handleConfirm}>
          {confirmLabel ?? t('confirm')}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
