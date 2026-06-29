'use client';

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FilePdf, Paperclip, Trash, UploadSimple } from '@phosphor-icons/react';
import { ApiClientError, apiFetch } from '@/lib/api/client';
import type { AttachmentDTO } from '@/lib/api/types';
import { IconButton } from '@/components/ui/icon-button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = 'image/*,application/pdf';

function isAllowed(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

export interface ReceiptUploaderProps {
  mode: 'create' | 'edit';
  /** Required in edit mode — attachments upload immediately to this expense. */
  expenseId?: string;
  /** CREATE mode: the staged files (controlled). */
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  /** EDIT mode: attachments already on the expense. */
  initialAttachments?: AttachmentDTO[];
}

/**
 * Drag/drop or pick receipts (images/PDF ≤ 8 MB). In CREATE mode it STAGES the
 * files for the parent to upload after the expense exists; in EDIT mode it
 * uploads immediately and manages the live attachment list.
 */
export function ReceiptUploader({
  mode,
  expenseId,
  files = [],
  onFilesChange,
  initialAttachments = [],
}: ReceiptUploaderProps) {
  const t = useTranslations('expenses');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const { toast } = useToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>(initialAttachments);
  const [uploading, setUploading] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  function validate(list: File[]): File[] {
    const valid: File[] = [];
    for (const file of list) {
      if (!isAllowed(file) || file.size > MAX_BYTES) {
        toast.error(te('validation'), { description: file.name });
        continue;
      }
      valid.push(file);
    }
    return valid;
  }

  async function uploadOne(file: File) {
    if (!expenseId) return;
    setUploading((count) => count + 1);
    try {
      const form = new FormData();
      form.append('file', file);
      const created = await apiFetch<AttachmentDTO>(`/api/expenses/${expenseId}/attachments`, {
        method: 'POST',
        body: form,
      });
      setAttachments((prev) => [...prev, created]);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : te('network'), {
        description: file.name,
      });
    } finally {
      setUploading((count) => Math.max(0, count - 1));
    }
  }

  function acceptFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const valid = validate(Array.from(list));
    if (valid.length === 0) return;
    if (mode === 'edit') {
      void Promise.all(valid.map((file) => uploadOne(file)));
    } else {
      onFilesChange?.([...files, ...valid]);
    }
  }

  async function deleteAttachment(attachment: AttachmentDTO) {
    if (!expenseId) return;
    setBusyId(attachment.id);
    try {
      await apiFetch(`/api/expenses/${expenseId}/attachments/${attachment.id}`, {
        method: 'DELETE',
      });
      setAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : te('network'));
    } finally {
      setBusyId(null);
    }
  }

  function removeStaged(index: number) {
    onFilesChange?.(files.filter((_, i) => i !== index));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(event.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'ease-smooth flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-150 outline-none',
          'focus-visible:ring-brand/55 focus-visible:ring-2',
          dragging
            ? 'border-brand bg-brand/5 text-content'
            : 'border-hairline-strong bg-surface-2/40 text-content-muted hover:bg-surface-2',
        )}
      >
        <UploadSimple size={22} aria-hidden="true" />
        <span className="text-content text-sm font-medium">{t('attachReceipt')}</span>
        <span className="text-content-subtle text-xs">PDF / JPG / PNG · ≤ 8 MB</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {uploading > 0 ? (
        <p className="text-content-muted flex items-center gap-2 text-xs">
          <Spinner size="xs" />
          {tc('saving')}
        </p>
      ) : null}

      {mode === 'edit' && attachments.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((attachment) => (
            <AttachmentTile
              key={attachment.id}
              name={attachment.fileName}
              mimeType={attachment.mimeType}
              url={attachment.url}
              busy={busyId === attachment.id}
              onRemove={() => void deleteAttachment(attachment)}
              removeLabel={tc('remove')}
            />
          ))}
        </ul>
      ) : null}

      {mode === 'create' && files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file, index) => (
            <StagedTile
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => removeStaged(index)}
              removeLabel={tc('remove')}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface TileShellProps {
  preview: ReactNode;
  name: string;
  busy?: boolean;
  onRemove: () => void;
  removeLabel: string;
}

function TileShell({ preview, name, busy, onRemove, removeLabel }: TileShellProps) {
  return (
    <li className="group border-hairline bg-surface relative overflow-hidden rounded-xl border">
      <div className="bg-surface-2 text-content-subtle flex h-24 items-center justify-center">
        {preview}
      </div>
      <p className="text-content-muted truncate px-2 py-1.5 text-xs" title={name}>
        {name}
      </p>
      <IconButton
        label={removeLabel}
        size="sm"
        variant="secondary"
        onClick={onRemove}
        disabled={busy}
        className="absolute top-1.5 right-1.5 h-7 w-7 opacity-90"
      >
        {busy ? <Spinner size="xs" /> : <Trash size={15} aria-hidden="true" />}
      </IconButton>
    </li>
  );
}

interface AttachmentTileProps {
  name: string;
  mimeType: string;
  url: string;
  busy: boolean;
  onRemove: () => void;
  removeLabel: string;
}

function AttachmentTile({ name, mimeType, url, busy, onRemove, removeLabel }: AttachmentTileProps) {
  const isImage = mimeType.startsWith('image/');
  return (
    <TileShell
      name={name}
      busy={busy}
      onRemove={onRemove}
      removeLabel={removeLabel}
      preview={
        isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <FilePdf size={28} aria-hidden="true" />
        )
      }
    />
  );
}

function StagedTile({
  file,
  onRemove,
  removeLabel,
}: {
  file: File;
  onRemove: () => void;
  removeLabel: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <TileShell
      name={file.name}
      onRemove={onRemove}
      removeLabel={removeLabel}
      preview={
        isImage && objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={objectUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : file.type === 'application/pdf' ? (
          <FilePdf size={28} aria-hidden="true" />
        ) : (
          <Paperclip size={26} aria-hidden="true" />
        )
      }
    />
  );
}
