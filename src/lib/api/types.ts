/**
 * API DTOs — the exact JSON shapes returned under `{ data }`. Dates are ISO
 * strings; money is integer minor units; Decimals are numbers. Both the route
 * handlers (via serializers) and the frontend depend on these.
 */

export type SplitMethodDTO =
  'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ADJUSTMENT' | 'ITEMIZED';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  image: string | null;
  defaultCurrency: string;
  locale: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  emailVerified: boolean;
  hasPassword: boolean;
  notifyExpenseEmail: boolean;
  notifyReminderEmail: boolean;
  notifyInviteEmail: boolean;
  notifyCommentEmail: boolean;
  notifyInApp: boolean;
}

export interface MemberDTO {
  id: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INVITED' | 'LEFT';
  email: string | null;
  userId: string | null;
  image: string | null;
  isYou: boolean;
}

export interface GroupSummaryDTO {
  id: string;
  type: 'STANDARD' | 'DIRECT';
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  baseCurrency: string;
  archived: boolean;
  memberCount: number;
  yourNet: number; // base minor units (+ you are owed, - you owe)
  /** For DIRECT groups, the other person's display name. */
  counterpartName?: string | null;
}

export interface GroupDTO {
  id: string;
  type: 'STANDARD' | 'DIRECT';
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  baseCurrency: string;
  simplifyDebts: boolean;
  archived: boolean;
  createdAt: string;
  members: MemberDTO[];
  yourMemberId: string | null;
  yourRole: 'ADMIN' | 'MEMBER' | null;
}

export interface ExpensePayerDTO {
  memberId: string;
  paidAmount: number; // base minor units
}

export interface ExpenseSplitDTO {
  memberId: string;
  owedAmount: number; // base minor units
  shareValue: number | null;
}

export interface ExpenseItemDTO {
  id: string;
  description: string;
  amount: number; // base minor units
  memberIds: string[];
}

export interface AttachmentDTO {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface ExpenseDTO {
  id: string;
  groupId: string;
  description: string;
  category: string;
  note: string | null;
  currency: string;
  amount: number; // entry-currency minor units
  amountBase: number; // base-currency minor units
  exchangeRate: number;
  date: string;
  splitMethod: SplitMethodDTO;
  createdById: string | null;
  recurringRuleId: string | null;
  payers: ExpensePayerDTO[];
  splits: ExpenseSplitDTO[];
  items: ExpenseItemDTO[];
  attachments: AttachmentDTO[];
  commentCount: number;
  createdAt: string;
}

export interface CommentDTO {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; image: string | null } | null;
}

export interface SettlementDTO {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number; // base minor units
  currency: string;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface TransferDTO {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

export interface BalanceEntryDTO {
  memberId: string;
  net: number; // base minor units
}

export interface BalancesDTO {
  currency: string;
  simplifyDebts: boolean;
  members: MemberDTO[];
  net: BalanceEntryDTO[];
  simplified: TransferDTO[];
  pairwise: TransferDTO[];
}

export interface ActivityDTO {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  actor: { name: string; image: string | null } | null;
  groupId: string | null;
  groupName: string | null;
  expenseId: string | null;
}

export interface NotificationDTO {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface PendingInviteDTO {
  id: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  memberId: string;
  expiresAt: string;
}

export interface DashboardDTO {
  totalOwed: number; // others owe you (sum, in your default currency)
  totalOwe: number; // you owe (sum)
  net: number;
  currency: string;
  groups: GroupSummaryDTO[];
}

export interface StatsPointDTO {
  label: string;
  total: number;
}

export interface StatsDTO {
  currency: string;
  total: number;
  yourShare: number;
  overTime: StatsPointDTO[];
  byCategory: { category: string; total: number }[];
  byMember: { memberId: string; name: string; total: number }[];
}
