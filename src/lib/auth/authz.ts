import type { Group, GroupMember } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/http';
import { requireUser, type SessionUser } from './session';

export interface GroupContext {
  user: SessionUser;
  group: Group;
  membership: GroupMember;
}

/** The current user's active membership in a group, or null. */
export async function getActiveMembership(
  userId: string,
  groupId: string,
): Promise<GroupMember | null> {
  return prisma.groupMember.findFirst({
    where: { groupId, userId, status: 'ACTIVE' },
  });
}

/** Require the signed-in user to be an active member of the group. */
export async function requireGroupMembership(groupId: string): Promise<GroupContext> {
  const user = await requireUser();
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw Errors.notFound('Group not found.');
  const membership = await getActiveMembership(user.id, groupId);
  if (!membership) throw Errors.forbidden('You are not a member of this group.');
  return { user, group, membership };
}

/** Require the signed-in user to be an admin of the group. */
export async function requireGroupAdmin(groupId: string): Promise<GroupContext> {
  const ctx = await requireGroupMembership(groupId);
  if (ctx.membership.role !== 'ADMIN') {
    throw Errors.forbidden('This action requires the admin role.');
  }
  return ctx;
}

/** Load an expense and assert the user may access it (via group membership). */
export async function requireExpenseAccess(expenseId: string) {
  const user = await requireUser();
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.deletedAt) throw Errors.notFound('Expense not found.');
  const membership = await getActiveMembership(user.id, expense.groupId);
  if (!membership) throw Errors.forbidden('You are not a member of this group.');
  return { user, expense, membership };
}
