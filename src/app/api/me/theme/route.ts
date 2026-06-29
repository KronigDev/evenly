import { z } from 'zod';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, ok, parseBody } from '@/lib/http';

const schema = z.object({ theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']) });

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();
  const { theme } = await parseBody(req, schema);
  await prisma.user.update({ where: { id: user.id }, data: { theme } });
  return ok({ theme });
});
