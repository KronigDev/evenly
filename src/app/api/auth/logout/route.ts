import { assertCsrf } from '@/lib/auth/csrf';
import { destroyCurrentSession } from '@/lib/auth/session';
import { apiHandler, ok } from '@/lib/http';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  await destroyCurrentSession();
  return ok({ success: true });
});
