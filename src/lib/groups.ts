import { recordActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import type { CreateGroupInput } from '@/lib/validation/group';

/** Create a standard group with the creator as its first admin member. */
export async function createStandardGroup(
  input: CreateGroupInput,
  owner: { id: string; name: string; email: string },
): Promise<string> {
  const group = await prisma.group.create({
    data: {
      type: 'STANDARD',
      name: input.name,
      description: input.description ?? null,
      emoji: input.emoji ?? null,
      color: input.color ?? null,
      baseCurrency: input.baseCurrency,
      simplifyDebts: input.simplifyDebts,
      createdById: owner.id,
      members: {
        create: {
          userId: owner.id,
          displayName: owner.name,
          email: owner.email,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      },
    },
  });
  await recordActivity({
    groupId: group.id,
    actorId: owner.id,
    type: 'GROUP_CREATED',
    data: { name: group.name },
  });
  return group.id;
}

/**
 * Create a 1:1 "direct" balance with another person. The counterpart is a
 * placeholder member (optionally carrying an email for a later invite).
 * Returns the group id and the counterpart member id.
 */
export async function createDirectGroup(
  owner: { id: string; name: string; email: string },
  counterpart: { name?: string | null; email?: string | null },
  baseCurrency: string,
): Promise<{ groupId: string; counterpartMemberId: string }> {
  const email = counterpart.email?.toLowerCase() ?? null;
  const displayName = counterpart.name?.trim() || email?.split('@')[0] || 'Friend';

  const group = await prisma.group.create({
    data: {
      type: 'DIRECT',
      name: displayName,
      baseCurrency,
      simplifyDebts: true,
      createdById: owner.id,
      members: {
        create: [
          {
            userId: owner.id,
            displayName: owner.name,
            email: owner.email,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
          {
            displayName,
            email,
            role: 'MEMBER',
            status: email ? 'INVITED' : 'ACTIVE',
            invitedById: owner.id,
          },
        ],
      },
    },
    include: { members: true },
  });

  const counterpartMember = group.members.find((m) => m.userId !== owner.id);
  return { groupId: group.id, counterpartMemberId: counterpartMember?.id ?? '' };
}

/** The active member id for a user in a group (or null). */
export async function userMemberId(groupId: string, userId: string): Promise<string | null> {
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId, status: 'ACTIVE' },
    select: { id: true },
  });
  return member?.id ?? null;
}
