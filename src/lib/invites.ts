import type { Group, GroupMember, Invite, Prisma } from '@prisma/client';
import { INVITE_TTL_MS } from '@/lib/auth/constants';
import { generateOpaqueToken, hashToken } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db';
import { Errors } from '@/lib/http';

/**
 * Move all financial records (payments, splits, item splits, settlements) from
 * one member to another, merging on unique-key collisions, then delete the
 * source member. Used to merge a placeholder member into a real account so all
 * existing balances stay correct.
 */
async function reassignMember(
  tx: Prisma.TransactionClient,
  fromId: string,
  toId: string,
): Promise<void> {
  const payers = await tx.expensePayer.findMany({ where: { memberId: fromId } });
  for (const p of payers) {
    const clash = await tx.expensePayer.findUnique({
      where: { expenseId_memberId: { expenseId: p.expenseId, memberId: toId } },
    });
    if (clash) {
      await tx.expensePayer.update({
        where: { id: clash.id },
        data: { paidAmount: clash.paidAmount + p.paidAmount },
      });
      await tx.expensePayer.delete({ where: { id: p.id } });
    } else {
      await tx.expensePayer.update({ where: { id: p.id }, data: { memberId: toId } });
    }
  }

  const splits = await tx.expenseSplit.findMany({ where: { memberId: fromId } });
  for (const s of splits) {
    const clash = await tx.expenseSplit.findUnique({
      where: { expenseId_memberId: { expenseId: s.expenseId, memberId: toId } },
    });
    if (clash) {
      await tx.expenseSplit.update({
        where: { id: clash.id },
        data: { owedAmount: clash.owedAmount + s.owedAmount },
      });
      await tx.expenseSplit.delete({ where: { id: s.id } });
    } else {
      await tx.expenseSplit.update({ where: { id: s.id }, data: { memberId: toId } });
    }
  }

  const itemSplits = await tx.expenseItemSplit.findMany({ where: { memberId: fromId } });
  for (const s of itemSplits) {
    const clash = await tx.expenseItemSplit.findUnique({
      where: { itemId_memberId: { itemId: s.itemId, memberId: toId } },
    });
    if (clash) {
      await tx.expenseItemSplit.update({
        where: { id: clash.id },
        data: { owedAmount: clash.owedAmount + s.owedAmount },
      });
      await tx.expenseItemSplit.delete({ where: { id: s.id } });
    } else {
      await tx.expenseItemSplit.update({ where: { id: s.id }, data: { memberId: toId } });
    }
  }

  await tx.settlement.updateMany({ where: { fromMemberId: fromId }, data: { fromMemberId: toId } });
  await tx.settlement.updateMany({ where: { toMemberId: fromId }, data: { toMemberId: toId } });
  // Drop any settlements that became self-referential after the merge.
  const selfSettlements = await tx.settlement.findMany({
    where: { fromMemberId: toId, toMemberId: toId },
    select: { id: true },
  });
  if (selfSettlements.length > 0) {
    await tx.settlement.deleteMany({ where: { id: { in: selfSettlements.map((s) => s.id) } } });
  }

  await tx.groupMember.delete({ where: { id: fromId } });
}

export interface CreateInviteResult {
  invite: Invite;
  member: GroupMember;
  token: string;
  reused: boolean;
}

/**
 * Invite an email to a group. Creates (or reuses) a placeholder member so the
 * person can immediately be included in expenses, and issues a fresh token.
 */
export async function createInvite(params: {
  groupId: string;
  email: string;
  invitedById: string;
  displayName?: string | null;
}): Promise<CreateInviteResult> {
  const email = params.email.trim().toLowerCase();

  const existingActive = await prisma.groupMember.findFirst({
    where: {
      groupId: params.groupId,
      status: 'ACTIVE',
      OR: [{ email }, { user: { email } }],
    },
  });
  if (existingActive) {
    throw Errors.conflict('This person is already a member of the group.', { field: 'email' });
  }

  let member = await prisma.groupMember.findFirst({
    where: { groupId: params.groupId, email, status: 'INVITED' },
  });
  const reused = Boolean(member);
  if (!member) {
    const displayName = params.displayName?.trim() || email.split('@')[0] || email;
    member = await prisma.groupMember.create({
      data: {
        groupId: params.groupId,
        email,
        displayName,
        status: 'INVITED',
        role: 'MEMBER',
        invitedById: params.invitedById,
      },
    });
  }

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invite = await prisma.invite.upsert({
    where: { groupId_email: { groupId: params.groupId, email } },
    update: {
      tokenHash,
      status: 'PENDING',
      invitedById: params.invitedById,
      memberId: member.id,
      expiresAt,
      acceptedByUserId: null,
      acceptedAt: null,
    },
    create: {
      groupId: params.groupId,
      email,
      tokenHash,
      memberId: member.id,
      invitedById: params.invitedById,
      expiresAt,
    },
  });

  return { invite, member, token, reused };
}

export type InvitePeek =
  | { status: 'valid'; group: Group; email: string; inviterName: string | null }
  | { status: 'accepted'; group: Group }
  | { status: 'expired'; group: Group }
  | { status: 'revoked' }
  | { status: 'invalid' };

/** Inspect an invite token without consuming it (for the acceptance page). */
export async function peekInvite(token: string): Promise<InvitePeek> {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { group: true, invitedBy: { select: { name: true } } },
  });
  if (!invite) return { status: 'invalid' };
  if (invite.status === 'REVOKED') return { status: 'revoked' };
  if (invite.status === 'ACCEPTED') return { status: 'accepted', group: invite.group };
  if (invite.expiresAt.getTime() < Date.now()) return { status: 'expired', group: invite.group };
  return {
    status: 'valid',
    group: invite.group,
    email: invite.email,
    inviterName: invite.invitedBy?.name ?? null,
  };
}

/** Accept an invite for a signed-in user, merging the placeholder member. */
export async function acceptInvite(params: {
  token: string;
  userId: string;
}): Promise<{ groupId: string }> {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(params.token) },
  });
  if (!invite) throw Errors.notFound('This invitation link is invalid.');
  if (invite.status === 'REVOKED') throw Errors.conflict('This invitation was revoked.');

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user || user.deletedAt) throw Errors.unauthorized();

  if (invite.status === 'ACCEPTED') {
    const existing = await prisma.groupMember.findFirst({
      where: { groupId: invite.groupId, userId: user.id },
    });
    if (existing) return { groupId: invite.groupId };
    throw Errors.conflict('This invitation has already been used.');
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.invite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
    throw Errors.conflict('This invitation has expired.');
  }

  await prisma.$transaction(async (tx) => {
    const already = await tx.groupMember.findFirst({
      where: { groupId: invite.groupId, userId: user.id },
    });
    const placeholder = await tx.groupMember.findUnique({ where: { id: invite.memberId } });

    if (already) {
      if (placeholder && placeholder.id !== already.id && !placeholder.userId) {
        await reassignMember(tx, placeholder.id, already.id);
      }
      if (already.status === 'LEFT') {
        await tx.groupMember.update({
          where: { id: already.id },
          data: { status: 'ACTIVE', leftAt: null },
        });
      }
    } else if (placeholder && !placeholder.userId) {
      await tx.groupMember.update({
        where: { id: placeholder.id },
        data: {
          userId: user.id,
          status: 'ACTIVE',
          displayName: placeholder.displayName || user.name,
          joinedAt: new Date(),
        },
      });
    } else {
      await tx.groupMember.create({
        data: {
          groupId: invite.groupId,
          userId: user.id,
          displayName: user.name,
          email: user.email,
          status: 'ACTIVE',
          role: 'MEMBER',
        },
      });
    }

    await tx.invite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedByUserId: user.id, acceptedAt: new Date() },
    });
  });

  return { groupId: invite.groupId };
}

/**
 * Auto-attach any pending placeholder memberships matching this user's email
 * (called after register / first sign-in) so invited people see their groups
 * even without clicking the link.
 */
export async function mergePlaceholdersForUser(userId: string, email: string): Promise<void> {
  const placeholders = await prisma.groupMember.findMany({
    where: { email: email.toLowerCase(), status: 'INVITED', userId: null },
  });
  for (const ph of placeholders) {
    await prisma.$transaction(async (tx) => {
      const already = await tx.groupMember.findFirst({
        where: { groupId: ph.groupId, userId },
      });
      if (already) {
        if (already.id !== ph.id) await reassignMember(tx, ph.id, already.id);
      } else {
        await tx.groupMember.update({
          where: { id: ph.id },
          data: { userId, status: 'ACTIVE', joinedAt: new Date() },
        });
      }
      await tx.invite.updateMany({
        where: { memberId: ph.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedByUserId: userId, acceptedAt: new Date() },
      });
    });
  }
}

/** Revoke a pending invite; removes the placeholder member if it has no activity. */
export async function revokeInvite(groupId: string, inviteId: string): Promise<void> {
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, groupId } });
  if (!invite) throw Errors.notFound('Invitation not found.');
  await prisma.$transaction(async (tx) => {
    await tx.invite.update({ where: { id: invite.id }, data: { status: 'REVOKED' } });
    const member = await tx.groupMember.findUnique({
      where: { id: invite.memberId },
      include: { _count: { select: { payers: true, splits: true } } },
    });
    if (member && member.status === 'INVITED' && !member.userId) {
      if (member._count.payers === 0 && member._count.splits === 0) {
        await tx.groupMember.delete({ where: { id: member.id } });
      }
    }
  });
}
