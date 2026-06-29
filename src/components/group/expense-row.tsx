'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils/cn';
import type { ExpenseDTO } from '@/lib/api/types';
import { useRelativeTime } from './queries';

type ShareKind = 'lent' | 'borrowed' | 'paid' | 'none';

interface ShareLine {
  kind: ShareKind;
  amount: number;
}

/** What the current member paid/owes on this expense, in base minor units. */
function computeShare(expense: ExpenseDTO, memberId: string | null): ShareLine {
  if (!memberId) return { kind: 'none', amount: 0 };
  const paid = expense.payers
    .filter((p) => p.memberId === memberId)
    .reduce((sum, p) => sum + p.paidAmount, 0);
  const owed = expense.splits
    .filter((s) => s.memberId === memberId)
    .reduce((sum, s) => sum + s.owedAmount, 0);
  const isPayer = expense.payers.some((p) => p.memberId === memberId);
  const inSplit = expense.splits.some((s) => s.memberId === memberId);
  if (!isPayer && !inSplit) return { kind: 'none', amount: 0 };

  const net = paid - owed;
  if (net > 0) return { kind: 'lent', amount: net };
  if (net < 0) return { kind: 'borrowed', amount: -net };
  if (paid > 0) return { kind: 'paid', amount: paid };
  return { kind: 'none', amount: 0 };
}

export interface ExpenseRowProps {
  expense: ExpenseDTO;
  currentMemberId: string | null;
  baseCurrency: string;
  onSelect: (expense: ExpenseDTO) => void;
}

export function ExpenseRow({ expense, currentMemberId, baseCurrency, onSelect }: ExpenseRowProps) {
  const t = useTranslations('expenses');
  const locale = useLocale();
  const relative = useRelativeTime();
  const share = computeShare(expense, currentMemberId);

  const shareToneClass: Record<ShareKind, string> = {
    lent: 'text-positive',
    borrowed: 'text-negative',
    paid: 'text-content-muted',
    none: 'text-content-subtle',
  };

  function shareLabel(): string {
    const formatted = formatMoney(share.amount, baseCurrency, locale);
    switch (share.kind) {
      case 'lent':
        return t('lentAmount', { amount: formatted });
      case 'borrowed':
        return t('borrowedAmount', { amount: formatted });
      case 'paid':
        return t('youPaid', { amount: formatted });
      default:
        return t('notInvolved');
    }
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(expense)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-100 ease-smooth hover:bg-surface-2 focus-visible:bg-surface-2"
    >
      <CategoryIcon category={expense.category} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content">{expense.description}</p>
        <p className="mt-0.5 truncate text-xs text-content-subtle">{relative(expense.date)}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <Money
          cents={expense.amount}
          currency={expense.currency}
          className="text-sm font-medium text-content"
        />
        <span className={cn('text-xs', shareToneClass[share.kind])}>{shareLabel()}</span>
      </div>
    </button>
  );
}
