import { z } from 'zod';
import { assertCsrf } from '@/lib/auth/csrf';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, ok, parseBody } from '@/lib/http';

const schema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string()).optional(),
});

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();
  const { all, ids } = await parseBody(req, schema);

  if (all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  } else if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: user.id, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return ok({ success: true });
});
