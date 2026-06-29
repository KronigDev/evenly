import { z } from 'zod';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/session';
import { apiHandler, ok, parseBody } from '@/lib/http';
import { acceptInvite } from '@/lib/invites';

const schema = z.object({ token: z.string().min(1) });

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();
  const { token } = await parseBody(req, schema);

  const { groupId } = await acceptInvite({ token, userId: user.id });

  return ok({ groupId });
});
