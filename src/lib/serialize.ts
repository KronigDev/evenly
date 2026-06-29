import type {
  Activity,
  Comment,
  Expense,
  ExpenseItem,
  ExpenseItemSplit,
  ExpensePayer,
  ExpenseSplit,
  Group,
  GroupMember,
  Notification,
  Settlement,
  User,
} from '@prisma/client';
import type {
  ActivityDTO,
  AttachmentDTO,
  CommentDTO,
  ExpenseDTO,
  GroupDTO,
  MemberDTO,
  NotificationDTO,
  SettlementDTO,
  UserDTO,
} from '@/lib/api/types';

export function fileUrl(storageKey: string): string {
  return `/api/files/${storageKey}`;
}

export function serializeUser(user: User, hasPassword: boolean): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ? fileUrl(user.image) : null,
    defaultCurrency: user.defaultCurrency,
    locale: user.locale,
    theme: user.theme,
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword,
    notifyExpenseEmail: user.notifyExpenseEmail,
    notifyReminderEmail: user.notifyReminderEmail,
    notifyInviteEmail: user.notifyInviteEmail,
    notifyCommentEmail: user.notifyCommentEmail,
    notifyInApp: user.notifyInApp,
  };
}

type MemberWithUser = GroupMember & { user?: Pick<User, 'name' | 'image'> | null };

export function serializeMember(member: MemberWithUser, currentUserId: string | null): MemberDTO {
  return {
    id: member.id,
    displayName: member.user?.name ?? member.displayName,
    role: member.role,
    status: member.status,
    email: member.email,
    userId: member.userId,
    image: member.user?.image ? fileUrl(member.user.image) : null,
    isYou: Boolean(member.userId && member.userId === currentUserId),
  };
}

type GroupWithMembers = Group & { members: MemberWithUser[] };

export function serializeGroup(group: GroupWithMembers, currentUserId: string | null): GroupDTO {
  const yours = group.members.find((m) => m.userId === currentUserId) ?? null;
  return {
    id: group.id,
    type: group.type,
    name: group.name,
    description: group.description,
    emoji: group.emoji,
    color: group.color,
    baseCurrency: group.baseCurrency,
    simplifyDebts: group.simplifyDebts,
    archived: Boolean(group.archivedAt),
    createdAt: group.createdAt.toISOString(),
    members: group.members.map((m) => serializeMember(m, currentUserId)),
    yourMemberId: yours?.id ?? null,
    yourRole: yours?.role ?? null,
  };
}

type ExpenseFull = Expense & {
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  items: (ExpenseItem & { splits: ExpenseItemSplit[] })[];
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    storageKey: string;
  }[];
  _count?: { comments: number };
};

export function serializeExpense(expense: ExpenseFull): ExpenseDTO {
  return {
    id: expense.id,
    groupId: expense.groupId,
    description: expense.description,
    category: expense.category,
    note: expense.note,
    currency: expense.currency,
    amount: expense.amount,
    amountBase: expense.amountBase,
    exchangeRate: Number(expense.exchangeRate),
    date: expense.date.toISOString(),
    splitMethod: expense.splitMethod,
    createdById: expense.createdById,
    recurringRuleId: expense.recurringRuleId,
    payers: expense.payers.map((p) => ({ memberId: p.memberId, paidAmount: p.paidAmount })),
    splits: expense.splits.map((s) => ({
      memberId: s.memberId,
      owedAmount: s.owedAmount,
      shareValue: s.shareValue === null ? null : Number(s.shareValue),
    })),
    items: expense.items.map((it) => ({
      id: it.id,
      description: it.description,
      amount: it.amount,
      memberIds: it.splits.map((s) => s.memberId),
    })),
    attachments: expense.attachments.map((a): AttachmentDTO => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      url: fileUrl(a.storageKey),
    })),
    commentCount: expense._count?.comments ?? 0,
    createdAt: expense.createdAt.toISOString(),
  };
}

export function serializeComment(
  comment: Comment & { author?: Pick<User, 'name' | 'image'> | null },
): CommentDTO {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author
      ? {
          name: comment.author.name,
          image: comment.author.image ? fileUrl(comment.author.image) : null,
        }
      : null,
  };
}

export function serializeSettlement(settlement: Settlement): SettlementDTO {
  return {
    id: settlement.id,
    fromMemberId: settlement.fromMemberId,
    toMemberId: settlement.toMemberId,
    amount: settlement.amount,
    currency: settlement.currency,
    date: settlement.date.toISOString(),
    note: settlement.note,
    createdAt: settlement.createdAt.toISOString(),
  };
}

export function serializeActivity(
  activity: Activity & {
    actor?: Pick<User, 'name' | 'image'> | null;
    group?: Pick<Group, 'name'> | null;
  },
): ActivityDTO {
  return {
    id: activity.id,
    type: activity.type,
    data: (activity.data as Record<string, unknown>) ?? {},
    createdAt: activity.createdAt.toISOString(),
    actor: activity.actor
      ? {
          name: activity.actor.name,
          image: activity.actor.image ? fileUrl(activity.actor.image) : null,
        }
      : null,
    groupId: activity.groupId,
    groupName: activity.group?.name ?? null,
    expenseId: activity.expenseId,
  };
}

export function serializeNotification(notification: Notification): NotificationDTO {
  return {
    id: notification.id,
    type: notification.type,
    data: (notification.data as Record<string, unknown>) ?? {},
    read: Boolean(notification.readAt),
    createdAt: notification.createdAt.toISOString(),
  };
}
