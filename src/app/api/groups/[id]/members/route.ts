import { assertCsrf } from '@/lib/auth/csrf';
import { requireGroupMembership } from '@/lib/auth/authz';
import { prisma } from '@/lib/db';
import { apiHandler, created, parseBody } from '@/lib/http';
import { serializeMember } from '@/lib/serialize';
import { addPlaceholderSchema } from '@/lib/validation/member';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user } = await requireGroupMembership(id);
  const { name } = await parseBody(req, addPlaceholderSchema);

  const member = await prisma.groupMember.create({
    data: {
      groupId: id,
      displayName: name,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });

  return created(serializeMember(member, user.id));
});
