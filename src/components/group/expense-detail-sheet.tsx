'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChatCircle,
  FileText,
  PaperPlaneRight,
  PencilSimple,
  TrashSimple,
} from '@phosphor-icons/react';
import { Sheet, SheetBody, SheetFooter, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Money } from '@/components/ui/money';
import { CategoryIcon } from '@/components/ui/category-icon';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/api/client';
import { categoryMeta } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { CommentDTO, ExpenseDTO, MemberDTO } from '@/lib/api/types';
import { useUser } from '@/components/app/user-context';
import { ConfirmDialog } from './confirm-dialog';
import { buildMemberMap, expenseKeys, useInvalidateGroup, useRelativeTime } from './queries';

export interface ExpenseDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  expense: ExpenseDTO | null;
  members: MemberDTO[];
  baseCurrency: string;
}

export function ExpenseDetailSheet({
  open,
  onOpenChange,
  groupId,
  expense,
  members,
  baseCurrency,
}: ExpenseDetailSheetProps) {
  const t = useTranslations('expenses');
  const tCat = useTranslations('categories');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale();
  const { toast } = useToast();
  const user = useUser();
  const relative = useRelativeTime();
  const queryClient = useQueryClient();
  const invalidateGroup = useInvalidateGroup(groupId);

  const expenseId = expense?.id ?? null;
  const memberMap = buildMemberMap(members);
  const [body, setBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detailQuery = useQuery({
    queryKey: expenseKeys.detail(expenseId ?? 'none'),
    queryFn: ({ signal }) => apiFetch<ExpenseDTO>(`/api/expenses/${expenseId}`, { signal }),
    enabled: open && Boolean(expenseId),
    initialData: expense ?? undefined,
  });

  const commentsQuery = useQuery({
    queryKey: expenseKeys.comments(expenseId ?? 'none'),
    queryFn: ({ signal }) =>
      apiFetch<CommentDTO[]>(`/api/expenses/${expenseId}/comments`, { signal }),
    enabled: open && Boolean(expenseId),
  });

  const addComment = useMutation({
    mutationFn: (text: string) =>
      apiFetch<CommentDTO>(`/api/expenses/${expenseId}/comments`, {
        method: 'POST',
        body: { body: text },
      }),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({ queryKey: expenseKeys.comments(expenseId ?? 'none') });
      await queryClient.invalidateQueries({ queryKey: expenseKeys.detail(expenseId ?? 'none') });
    },
    onError: () => toast.error(te('generic')),
  });

  const deleteExpense = useMutation({
    mutationFn: () => apiFetch(`/api/expenses/${expenseId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success(t('deleteExpense'));
      onOpenChange(false);
      await invalidateGroup();
    },
  });

  const active = detailQuery.data ?? expense;

  function memberName(id: string): string {
    return memberMap.get(id)?.displayName ?? tc('none');
  }

  function memberLike(id: string): MemberDTO {
    return (
      memberMap.get(id) ?? {
        id,
        displayName: tc('none'),
        role: 'MEMBER',
        status: 'LEFT',
        email: null,
        userId: null,
        image: null,
        isYou: false,
      }
    );
  }

  function onSubmitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || addComment.isPending) return;
    addComment.mutate(text);
  }

  const comments = commentsQuery.data ?? [];
  const showConverted = active
    ? active.currency.toUpperCase() !== baseCurrency.toUpperCase()
    : false;

  return (
    <Sheet
      open={open && Boolean(expenseId)}
      onOpenChange={onOpenChange}
      side="right"
      aria-label={t('expenseDetails')}
    >
      <SheetHeader title={t('expenseDetails')} onClose={() => onOpenChange(false)} />
      <SheetBody className="space-y-6">
        {active ? (
          <>
            {/* Summary */}
            <div className="flex items-start gap-3">
              <CategoryIcon category={active.category} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-content">{active.description}</h3>
                <p className="mt-0.5 text-xs text-content-subtle">
                  {tCat(categoryMeta(active.category).key)} · {relative(active.date)}
                </p>
              </div>
              <div className="text-right">
                <Money
                  cents={active.amount}
                  currency={active.currency}
                  className="text-base font-semibold text-content"
                />
                {showConverted ? (
                  <p className="mt-0.5 text-xs text-content-subtle">
                    {t('convertedAmount', {
                      amount: formatMoney(active.amountBase, baseCurrency, locale),
                      currency: baseCurrency,
                    })}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Paid by */}
            <section className="space-y-2">
              <p className="eyebrow">{t('paidBy')}</p>
              <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
                {active.payers.map((payer) => (
                  <li key={payer.memberId} className="flex items-center gap-3 px-3 py-2.5">
                    <MemberAvatar member={memberLike(payer.memberId)} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-content">
                      {memberName(payer.memberId)}
                    </span>
                    <Money
                      cents={payer.paidAmount}
                      currency={baseCurrency}
                      className="text-sm font-medium text-content"
                    />
                  </li>
                ))}
              </ul>
            </section>

            {/* Split breakdown */}
            <section className="space-y-2">
              <p className="eyebrow">{t('splitBetween')}</p>
              <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
                {active.splits.map((split) => (
                  <li key={split.memberId} className="flex items-center gap-3 px-3 py-2.5">
                    <MemberAvatar member={memberLike(split.memberId)} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-content">
                      {memberName(split.memberId)}
                    </span>
                    <Money
                      cents={split.owedAmount}
                      currency={baseCurrency}
                      className="text-sm text-content-muted"
                    />
                  </li>
                ))}
              </ul>
            </section>

            {/* Note */}
            {active.note ? (
              <section className="space-y-1.5">
                <p className="eyebrow">{t('notes')}</p>
                <p className="whitespace-pre-wrap text-sm text-content-muted">{active.note}</p>
              </section>
            ) : null}

            {/* Attachments */}
            {active.attachments.length > 0 ? (
              <section className="space-y-2">
                <p className="eyebrow">{t('receipt')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {active.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-square overflow-hidden rounded-lg border border-hairline bg-surface-2"
                      title={attachment.fileName}
                    >
                      {attachment.mimeType.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachment.url}
                          alt={attachment.fileName}
                          className="h-full w-full object-cover transition-transform duration-200 ease-smooth group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-content-muted">
                          <FileText size={22} />
                          <span className="line-clamp-2 text-2xs">{attachment.fileName}</span>
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Comments */}
            <section className="space-y-3">
              <p className="eyebrow">{t('comments')}</p>
              {comments.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-content-subtle">
                  <ChatCircle size={16} />
                  {t('noComments')}
                </p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((comment) => (
                    <li key={comment.id} className="flex gap-2.5">
                      <Avatar
                        name={comment.author?.name ?? '?'}
                        image={comment.author?.image ?? null}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-sm font-medium text-content">
                            {comment.author?.name ?? tc('none')}
                          </span>
                          <span className="shrink-0 text-xs text-content-subtle">
                            {relative(comment.createdAt)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-content-muted">
                          {comment.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={onSubmitComment} className="flex items-center gap-2">
                <Avatar name={user.name} image={user.image} size="sm" />
                <Input
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={t('commentPlaceholder')}
                  aria-label={t('addComment')}
                  maxLength={2000}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="shrink-0 px-3"
                  loading={addComment.isPending}
                  disabled={body.trim().length === 0}
                  aria-label={tc('send')}
                >
                  <PaperPlaneRight size={16} />
                </Button>
              </form>
            </section>
          </>
        ) : (
          <p className="text-sm text-content-muted">{tc('loading')}</p>
        )}
      </SheetBody>

      {active ? (
        <SheetFooter className="justify-between">
          <Button
            variant="ghost"
            leftIcon={<TrashSimple size={16} />}
            className="text-negative hover:bg-negative/10"
            onClick={() => setConfirmDelete(true)}
          >
            {tc('delete')}
          </Button>
          <Button asChild variant="secondary" leftIcon={<PencilSimple size={16} />}>
            <Link href={`/groups/${groupId}/expenses/${active.id}/edit`}>{tc('edit')}</Link>
          </Button>
        </SheetFooter>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteExpense')}
        description={t('deleteExpenseConfirm')}
        confirmLabel={tc('delete')}
        danger
        onConfirm={async () => {
          await deleteExpense.mutateAsync();
        }}
      />
    </Sheet>
  );
}
