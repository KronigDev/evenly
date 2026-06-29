import { groupMemberUserIds, notifyUsers, recordActivity } from '@/lib/activity';
import { requireExpenseAccess } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { apiHandler, created, ok, parseBody } from '@/lib/http';
import { serializeComment } from '@/lib/serialize';
import { commentSchema } from '@/lib/validation/profile';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const authorSelect = { author: { select: { name: true, image: true } } } as const;

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await requireExpenseAccess(id);

  const comments = await prisma.comment.findMany({
    where: { expenseId: id },
    include: authorSelect,
    orderBy: { createdAt: 'asc' },
  });

  return ok(comments.map(serializeComment));
});

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user, expense } = await requireExpenseAccess(id);
  const body = await parseBody(req, commentSchema);

  const comment = await prisma.comment.create({
    data: { expenseId: id, authorId: user.id, body: body.body },
    include: authorSelect,
  });

  await recordActivity({
    groupId: expense.groupId,
    actorId: user.id,
    type: 'COMMENT_ADDED',
    data: { description: expense.description },
    expenseId: id,
  });

  const recipients = await groupMemberUserIds(expense.groupId, user.id);
  await notifyUsers(recipients, {
    type: 'COMMENT_ADDED',
    data: {
      groupId: expense.groupId,
      expenseId: id,
      description: expense.description,
      author: user.name,
    },
  });

  return created(serializeComment(comment));
});
