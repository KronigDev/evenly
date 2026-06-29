import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupAdmin, requireGroupMembership } from '@/lib/auth/authz';
import { recordActivity } from '@/lib/activity';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, noContent, ok, parseBody } from '@/lib/http';
import { processGroupRecurring } from '@/lib/recurring';
import { serializeGroup } from '@/lib/serialize';
import { updateGroupSchema } from '@/lib/validation/group';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  const { id } = await params;
  const { user } = await requireGroupMembership(id);

  // Lazily generate any due recurring expenses before reading the group.
  await processGroupRecurring(id).catch((err) =>
    console.error('[groups] recurring generation failed:', err),
  );

  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { name: true, image: true } } } } },
  });
  if (!group) throw Errors.notFound('Group not found.');

  return ok(serializeGroup(group, user.id));
});

export const PATCH = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, group: existing } = await requireGroupAdmin(id);
  const input = await parseBody(req, updateGroupSchema);

  const data: {
    name?: string;
    description?: string | null;
    emoji?: string | null;
    color?: string | null;
    baseCurrency?: string;
    simplifyDebts?: boolean;
    archivedAt?: Date | null;
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.emoji !== undefined) data.emoji = input.emoji;
  if (input.color !== undefined) data.color = input.color;
  if (input.baseCurrency !== undefined) data.baseCurrency = input.baseCurrency;
  if (input.simplifyDebts !== undefined) data.simplifyDebts = input.simplifyDebts;

  let archivedToggled = false;
  if (input.archived !== undefined) {
    const currentlyArchived = Boolean(existing.archivedAt);
    if (currentlyArchived !== input.archived) {
      data.archivedAt = input.archived ? new Date() : null;
      archivedToggled = true;
    }
  }

  await prisma.group.update({ where: { id }, data });

  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { name: true, image: true } } } } },
  });
  if (!group) throw Errors.notFound('Group not found.');

  await recordActivity({
    groupId: id,
    actorId: user.id,
    type: archivedToggled ? 'GROUP_ARCHIVED' : 'GROUP_UPDATED',
    data: archivedToggled ? { archived: Boolean(group.archivedAt) } : { name: group.name },
  });

  return ok(serializeGroup(group, user.id));
});

export const DELETE = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  await requireGroupAdmin(id);

  await prisma.group.delete({ where: { id } });

  return noContent();
});
