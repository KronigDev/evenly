import { z } from 'zod';
import { assertCsrf } from '@/lib/auth/csrf';
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, ok, parseBody } from '@/lib/http';
import { setLocaleCookie } from '@/i18n/locale';

const schema = z.object({ locale: z.enum(['en', 'de']) });

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const { locale } = await parseBody(req, schema);
  await setLocaleCookie(locale);
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
  }
  return ok({ locale });
});
