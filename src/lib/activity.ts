import type { ActivityType, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export interface RecordActivityInput {
  groupId?: string | null;
  actorId?: string | null;
  type: ActivityType;
  data: Prisma.InputJsonValue;
  expenseId?: string | null;
}

export async function recordActivity(input: RecordActivityInput) {
  return prisma.activity.create({
    data: {
      groupId: input.groupId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      data: input.data,
      expenseId: input.expenseId ?? null,
    },
  });
}

export interface NotifyInput {
  type: NotificationType;
  data: Prisma.InputJsonValue;
}

/** Create in-app notifications for a set of users (deduplicated, skips empty). */
export async function notifyUsers(userIds: Array<string | null | undefined>, input: NotifyInput) {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: input.type,
      data: input.data as Prisma.NotificationCreateManyInput['data'],
    })),
  });
}

/**
 * Resolve the user ids of a group's active members, optionally excluding one
 * (typically the actor, who should not be notified about their own action).
 */
export async function groupMemberUserIds(
  groupId: string,
  excludeUserId?: string | null,
): Promise<string[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId, status: 'ACTIVE', userId: { not: null } },
    select: { userId: true },
  });
  return members
    .map((m) => m.userId)
    .filter((id): id is string => Boolean(id) && id !== excludeUserId);
}
