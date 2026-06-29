'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChartPieSlice,
  Coins,
  Equals,
  ListBullets,
  Percent,
  Plus,
  PlusMinus,
  Trash,
} from '@phosphor-icons/react';
import type { MemberDTO } from '@/lib/api/types';
import { allocateEqual, sumCents, type Cents } from '@/lib/money';
import {
  computeItemizedSplit,
  computeSplit,
  SplitError,
  type SplitInput,
  type SplitMethod,
  type SplitResultEntry,
} from '@/lib/split';
import { AmountInput } from '@/components/form/amount-input';
import { MemberMultiSelect } from '@/components/form/member-multi-select';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Input, controlBaseClass } from '@/components/ui/input';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { Money } from '@/components/ui/money';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils/cn';

export type { SplitMethod } from '@/lib/split';

/** Per-member input across every (non-itemized) split method. */
export interface SplitMemberState {
  included: boolean;
  /** EXACT — entry minor units. */
  exact: Cents;
  /** PERCENTAGE — 0–100. */
  percent: number;
  /** SHARES — positive weight. */
  shares: number;
  /** ADJUSTMENT — entry minor units (+/-). */
  adjust: Cents;
}

export interface SplitItemState {
  id: string;
  description: string;
  amount: Cents;
  memberIds: string[];
}

export interface SplitState {
  method: SplitMethod;
  members: Record<string, SplitMemberState>;
  items: SplitItemState[];
}

const METHOD_ORDER: SplitMethod[] = [
  'EQUAL',
  'EXACT',
  'PERCENTAGE',
  'SHARES',
  'ADJUSTMENT',
  'ITEMIZED',
];

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function defaultMemberState(): SplitMemberState {
  return { included: true, exact: 0, percent: 0, shares: 1, adjust: 0 };
}

function emptyItem(memberIds: string[]): SplitItemState {
  return { id: uid(), description: '', amount: 0, memberIds: [...memberIds] };
}

export function createInitialSplitState(
  members: MemberDTO[],
  method: SplitMethod = 'EQUAL',
): SplitState {
  const memberMap: Record<string, SplitMemberState> = {};
  for (const member of members) memberMap[member.id] = defaultMemberState();
  return {
    method,
    members: memberMap,
    items: [emptyItem(members.map((member) => member.id))],
  };
}

function memberState(state: SplitState, id: string): SplitMemberState {
  return state.members[id] ?? defaultMemberState();
}

/** Map one member's state to the `SplitInput` the engine expects. */
function toSplitInput(state: SplitState, id: string): SplitInput {
  const ms = memberState(state, id);
  switch (state.method) {
    case 'EQUAL':
      return { memberId: id, included: ms.included };
    case 'EXACT':
      return { memberId: id, value: ms.exact };
    case 'PERCENTAGE':
      return { memberId: id, value: ms.percent };
    case 'SHARES':
      return { memberId: id, value: ms.shares };
    case 'ADJUSTMENT':
      return { memberId: id, value: ms.adjust, included: ms.included };
    default:
      return { memberId: id };
  }
}

export interface SplitPreview {
  ok: boolean;
  entries: SplitResultEntry[];
  errorCode?: string;
}

/**
 * Compute the exact per-member allocation using the REAL split engine, so the
 * preview matches the server byte-for-byte. Never throws — invalid states
 * surface via `ok:false` + `errorCode`.
 */
export function computeSplitPreview(state: SplitState, totalMinor: number): SplitPreview {
  try {
    if (state.method === 'ITEMIZED') {
      const result = computeItemizedSplit(
        state.items.map((item) => ({ amount: item.amount, memberIds: item.memberIds })),
      );
      return { ok: true, entries: result.entries };
    }
    const ids = Object.keys(state.members);
    const entries = computeSplit(
      state.method,
      totalMinor,
      ids.map((id) => toSplitInput(state, id)),
    );
    return { ok: true, entries };
  } catch (error) {
    return {
      ok: false,
      entries: [],
      errorCode: error instanceof SplitError ? error.code : 'UNKNOWN',
    };
  }
}

export interface SplitPayload {
  splits?: { memberId: string; value?: number; included?: boolean }[];
  items?: { description: string; amount: number; memberIds: string[] }[];
  amount?: number;
}

/** Build the `{ splits?, items?, amount? }` portion of the request body. */
export function buildSplitPayload(
  state: SplitState,
  method: SplitMethod,
  totalMinor: number,
): SplitPayload {
  const ids = Object.keys(state.members);
  switch (method) {
    case 'EQUAL':
      return {
        splits: ids.map((id) => ({ memberId: id, included: memberState(state, id).included })),
      };
    case 'EXACT':
      return { splits: ids.map((id) => ({ memberId: id, value: memberState(state, id).exact })) };
    case 'PERCENTAGE':
      return { splits: ids.map((id) => ({ memberId: id, value: memberState(state, id).percent })) };
    case 'SHARES':
      return { splits: ids.map((id) => ({ memberId: id, value: memberState(state, id).shares })) };
    case 'ADJUSTMENT':
      return {
        splits: ids.map((id) => {
          const ms = memberState(state, id);
          return { memberId: id, value: ms.adjust, included: ms.included };
        }),
      };
    case 'ITEMIZED':
      return {
        items: state.items.map((item) => ({
          description: item.description,
          amount: item.amount,
          memberIds: item.memberIds,
        })),
        amount: sumCents(state.items.map((item) => item.amount)),
      };
    default:
      return { amount: totalMinor };
  }
}

export interface SplitEditorProps {
  members: MemberDTO[];
  currency: string;
  totalMinor: number;
  value: SplitState;
  onChange: (next: SplitState) => void;
  /** Itemized expenses drive the total from the items sum. */
  onTotalChange?: (totalMinor: number) => void;
}

export function SplitEditor({
  members,
  currency,
  totalMinor,
  value,
  onChange,
  onTotalChange,
}: SplitEditorProps) {
  const t = useTranslations('splits');
  const tc = useTranslations('common');
  const te = useTranslations('expenses');

  const itemsTotal = sumCents(value.items.map((item) => item.amount));

  // Keep the parent total in sync with the items sum while itemized.
  useEffect(() => {
    if (value.method === 'ITEMIZED') onTotalChange?.(itemsTotal);
  }, [value.method, itemsTotal, onTotalChange]);

  const methodLabels: Record<SplitMethod, string> = {
    EQUAL: t('equally'),
    EXACT: t('exactly'),
    PERCENTAGE: t('percentages'),
    SHARES: t('shares'),
    ADJUSTMENT: t('adjustments'),
    ITEMIZED: t('byItems'),
  };
  const methodHints: Record<SplitMethod, string> = {
    EQUAL: t('equalHint'),
    EXACT: t('exactHint'),
    PERCENTAGE: t('percentageHint'),
    SHARES: t('sharesHint'),
    ADJUSTMENT: t('adjustmentHint'),
    ITEMIZED: t('itemizedHint'),
  };

  const methodOptions = METHOD_ORDER.map((method) => ({
    value: method,
    icon: <MethodIcon method={method} />,
    label: <span className="sr-only sm:not-sr-only sm:inline">{methodLabels[method]}</span>,
  }));

  function setMethod(method: SplitMethod) {
    let next: SplitState = { ...value, method };
    if (method === 'ITEMIZED' && next.items.length === 0) {
      next = { ...next, items: [emptyItem(members.map((member) => member.id))] };
    }
    onChange(next);
  }

  function patchMember(id: string, patch: Partial<SplitMemberState>) {
    onChange({
      ...value,
      members: { ...value.members, [id]: { ...memberState(value, id), ...patch } },
    });
  }

  function setItems(items: SplitItemState[]) {
    onChange({ ...value, items });
  }

  const previewTotal = value.method === 'ITEMIZED' ? itemsTotal : totalMinor;
  const preview = computeSplitPreview(value, previewTotal);
  const owedById = new Map(preview.entries.map((entry) => [entry.memberId, entry.owedAmount]));

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={methodOptions}
        value={value.method}
        onChange={setMethod}
        size="sm"
        className="w-full"
        aria-label={t('splitMethod')}
      />

      <p className="text-content-muted text-xs">{methodHints[value.method]}</p>

      {value.method === 'EQUAL' ? (
        <MemberMultiSelect
          members={members}
          value={members
            .filter((member) => memberState(value, member.id).included)
            .map((m) => m.id)}
          onChange={(ids) => {
            const set = new Set(ids);
            const nextMembers: Record<string, SplitMemberState> = {};
            for (const member of members) {
              nextMembers[member.id] = {
                ...memberState(value, member.id),
                included: set.has(member.id),
              };
            }
            onChange({ ...value, members: nextMembers });
          }}
        />
      ) : null}

      {value.method === 'EXACT' ? (
        <MemberRows>
          {members.map((member) => (
            <MemberRow key={member.id} member={member} youLabel={tc('you')}>
              <AmountInput
                valueMinor={memberState(value, member.id).exact}
                onChangeMinor={(minor) => patchMember(member.id, { exact: minor })}
                currency={currency}
                containerClassName="w-32"
                aria-label={`${member.displayName} ${te('amount')}`}
              />
            </MemberRow>
          ))}
        </MemberRows>
      ) : null}

      {value.method === 'PERCENTAGE' ? (
        <MemberRows>
          {members.map((member) => (
            <MemberRow key={member.id} member={member} youLabel={tc('you')}>
              <NumberBox
                value={memberState(value, member.id).percent}
                onChange={(num) => patchMember(member.id, { percent: num })}
                suffix="%"
                step={0.1}
                min={0}
                max={100}
                ariaLabel={`${member.displayName} %`}
              />
            </MemberRow>
          ))}
        </MemberRows>
      ) : null}

      {value.method === 'SHARES' ? (
        <MemberRows>
          {members.map((member) => (
            <MemberRow key={member.id} member={member} youLabel={tc('you')}>
              <NumberBox
                value={memberState(value, member.id).shares}
                onChange={(num) => patchMember(member.id, { shares: num })}
                step={1}
                min={0}
                ariaLabel={`${member.displayName} ${t('shares')}`}
              />
            </MemberRow>
          ))}
        </MemberRows>
      ) : null}

      {value.method === 'ADJUSTMENT' ? (
        <MemberRows>
          {members.map((member) => {
            const ms = memberState(value, member.id);
            return (
              <MemberRow
                key={member.id}
                member={member}
                youLabel={tc('you')}
                included={ms.included}
                onIncludedChange={(included) => patchMember(member.id, { included })}
              >
                <AmountInput
                  valueMinor={ms.adjust}
                  onChangeMinor={(minor) => patchMember(member.id, { adjust: minor })}
                  currency={currency}
                  allowNegative
                  disabled={!ms.included}
                  containerClassName="w-32"
                  aria-label={`${member.displayName} ${t('adjustments')}`}
                />
              </MemberRow>
            );
          })}
        </MemberRows>
      ) : null}

      {value.method === 'ITEMIZED' ? (
        <ItemizedEditor
          members={members}
          currency={currency}
          items={value.items}
          onItemsChange={setItems}
        />
      ) : null}

      <StatusLine
        method={value.method}
        currency={currency}
        totalMinor={previewTotal}
        state={value}
        preview={preview}
      />

      {preview.entries.length > 0 ? (
        <div className="border-hairline bg-surface-2/60 rounded-xl border">
          <p className="border-hairline text-2xs tracking-eyebrow text-content-subtle border-b px-3 py-2 font-medium uppercase">
            {t('splitWith')}
          </p>
          <ul className="divide-hairline divide-y">
            {members
              .filter((member) => owedById.has(member.id))
              .map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <MemberAvatar member={member} size="sm" />
                    <span className="text-content truncate text-sm">{member.displayName}</span>
                  </span>
                  <Money cents={owedById.get(member.id) ?? 0} currency={currency} />
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function MemberRows({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-hairline border-hairline bg-surface divide-y overflow-hidden rounded-xl border">
      {children}
    </ul>
  );
}

interface MemberRowProps {
  member: MemberDTO;
  youLabel: string;
  children: ReactNode;
  included?: boolean;
  onIncludedChange?: (included: boolean) => void;
}

function MemberRow({ member, youLabel, children, included, onIncludedChange }: MemberRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2.5">
        {onIncludedChange ? (
          <input
            type="checkbox"
            checked={included ?? true}
            onChange={(event) => onIncludedChange(event.target.checked)}
            aria-label={member.displayName}
            className="accent-brand h-[18px] w-[18px] shrink-0 cursor-pointer"
          />
        ) : null}
        <MemberAvatar member={member} size="sm" />
        <span className="text-content truncate text-sm">{member.displayName}</span>
        {member.isYou ? (
          <span className="text-2xs tracking-eyebrow text-content-subtle shrink-0 font-medium uppercase">
            {youLabel}
          </span>
        ) : null}
      </span>
      {children}
    </li>
  );
}

interface NumberBoxProps {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  ariaLabel: string;
}

function NumberBox({ value, onChange, suffix, step, min, max, ariaLabel }: NumberBoxProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value === 0 ? '' : String(value);

  return (
    <div className="relative w-28 shrink-0">
      <input
        type="number"
        inputMode="decimal"
        value={display}
        step={step}
        min={min}
        max={max}
        placeholder="0"
        aria-label={ariaLabel}
        onFocus={(event) => {
          setText(value === 0 ? '' : String(value));
          setFocused(true);
          event.currentTarget.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const parsed = raw === '' ? 0 : Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className={cn(
          controlBaseClass,
          'tabular h-9 text-right font-mono',
          suffix ? 'pr-7 pl-3' : 'px-3',
        )}
      />
      {suffix ? (
        <span className="text-content-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

interface ItemizedEditorProps {
  members: MemberDTO[];
  currency: string;
  items: SplitItemState[];
  onItemsChange: (items: SplitItemState[]) => void;
}

function ItemizedEditor({ members, currency, items, onItemsChange }: ItemizedEditorProps) {
  const t = useTranslations('expenses');
  const ts = useTranslations('splits');
  const tc = useTranslations('common');

  function patchItem(id: string, patch: Partial<SplitItemState>) {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onItemsChange([...items, emptyItem(members.map((member) => member.id))]);
  }

  function removeItem(id: string) {
    onItemsChange(items.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="surface-card space-y-3 p-3">
          <div className="flex items-start gap-2">
            <Input
              value={item.description}
              onChange={(event) => patchItem(item.id, { description: event.target.value })}
              placeholder={t('itemName')}
              aria-label={`${t('itemName')} ${index + 1}`}
              className="flex-1"
            />
            <AmountInput
              valueMinor={item.amount}
              onChangeMinor={(minor) => patchItem(item.id, { amount: minor })}
              currency={currency}
              containerClassName="w-28"
              aria-label={`${t('itemAmount')} ${index + 1}`}
            />
            <IconButton
              label={tc('remove')}
              variant="ghost"
              onClick={() => removeItem(item.id)}
              disabled={items.length <= 1}
            >
              <Trash size={17} aria-hidden="true" />
            </IconButton>
          </div>
          <div>
            <p className="eyebrow mb-1.5">{t('splitBetween')}</p>
            <MemberMultiSelect
              members={members}
              value={item.memberIds}
              onChange={(ids) => patchItem(item.id, { memberIds: ids })}
              showSelectAll={false}
            />
            {item.memberIds.length === 0 ? (
              <p className="text-negative mt-1 text-xs">{ts('selectAtLeastOne')}</p>
            ) : null}
          </div>
        </div>
      ))}
      <Button variant="secondary" size="sm" leftIcon={<Plus size={15} />} onClick={addItem}>
        {t('addItem')}
      </Button>
    </div>
  );
}

interface StatusLineProps {
  method: SplitMethod;
  currency: string;
  totalMinor: number;
  state: SplitState;
  preview: SplitPreview;
}

function StatusLine({ method, currency, totalMinor, state, preview }: StatusLineProps) {
  const t = useTranslations('splits');
  const tc = useTranslations('common');
  const ids = Object.keys(state.members);

  if (method === 'EQUAL') {
    const includedCount = ids.filter((id) => memberState(state, id).included).length;
    if (includedCount === 0)
      return <StatusPill tone="negative">{t('selectAtLeastOne')}</StatusPill>;
    const share = allocateEqual(totalMinor, includedCount)[0] ?? 0;
    return (
      <StatusPill tone="neutral">
        {t('eachOwes', { amount: '' })}
        <Money cents={share} currency={currency} className="ml-1" />
      </StatusPill>
    );
  }

  if (method === 'EXACT') {
    const sum = sumCents(ids.map((id) => memberState(state, id).exact));
    const remaining = totalMinor - sum;
    if (remaining === 0) {
      return <StatusPill tone="positive">{t('remaining')} · 0</StatusPill>;
    }
    return (
      <StatusPill tone="negative">
        {remaining > 0 ? t('underBy', { amount: '' }) : t('overBy', { amount: '' })}
        <Money cents={Math.abs(remaining)} currency={currency} className="ml-1" />
      </StatusPill>
    );
  }

  if (method === 'PERCENTAGE') {
    const sum = ids.reduce((acc, id) => acc + memberState(state, id).percent, 0);
    const rounded = Math.round(sum * 100) / 100;
    return (
      <StatusPill tone={preview.ok ? 'positive' : 'negative'}>
        {t('percentTotal', { percent: rounded })}
      </StatusPill>
    );
  }

  if (method === 'SHARES') {
    const totalShares = ids.reduce((acc, id) => acc + (memberState(state, id).shares || 0), 0);
    return (
      <StatusPill tone={preview.ok ? 'neutral' : 'negative'}>
        {t('sharesTotal', { count: Math.round(totalShares) })}
      </StatusPill>
    );
  }

  if (method === 'ADJUSTMENT') {
    const includedCount = ids.filter((id) => memberState(state, id).included).length;
    if (includedCount === 0)
      return <StatusPill tone="negative">{t('selectAtLeastOne')}</StatusPill>;
    return <StatusPill tone="neutral">{t('adjustmentHint')}</StatusPill>;
  }

  // ITEMIZED
  const hasEmptyParticipants = state.items.some((item) => item.memberIds.length === 0);
  if (state.items.length === 0 || totalMinor <= 0) {
    return <StatusPill tone="neutral">{t('itemizedHint')}</StatusPill>;
  }
  return (
    <StatusPill tone={hasEmptyParticipants ? 'negative' : 'positive'}>
      {hasEmptyParticipants ? (
        t('selectAtLeastOne')
      ) : (
        <>
          {tc('total')}
          <Money cents={totalMinor} currency={currency} className="ml-1" />
        </>
      )}
    </StatusPill>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: 'neutral' | 'positive' | 'negative';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium',
        tone === 'positive' && 'bg-positive/10 text-positive',
        tone === 'negative' && 'bg-negative/10 text-negative',
        tone === 'neutral' && 'bg-surface-2 text-content-muted',
      )}
    >
      {children}
    </div>
  );
}

function MethodIcon({ method }: { method: SplitMethod }) {
  const props = { size: 16, 'aria-hidden': true } as const;
  switch (method) {
    case 'EQUAL':
      return <Equals {...props} />;
    case 'EXACT':
      return <Coins {...props} />;
    case 'PERCENTAGE':
      return <Percent {...props} />;
    case 'SHARES':
      return <ChartPieSlice {...props} />;
    case 'ADJUSTMENT':
      return <PlusMinus {...props} />;
    case 'ITEMIZED':
      return <ListBullets {...props} />;
    default:
      return null;
  }
}
