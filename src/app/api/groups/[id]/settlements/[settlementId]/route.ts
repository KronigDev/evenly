import { requireGroupMembership } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { apiHandler, noContent } from '@/lib/http';
import { deleteSettlement } from '@/lib/settlements';

interface RouteContext {
  params: Promise<{ id: string; settlementId: string }>;
}

export const DELETE = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id, settlementId } = await params;
  await assertCsrf(req);
  const { user } = await requireGroupMembership(id);

  await deleteSettlement(id, settlementId, user.id);

  return noContent();
});
