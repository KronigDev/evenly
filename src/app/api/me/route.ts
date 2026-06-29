import { assertCsrf } from '@/lib/auth/csrf';
import {
  currentUserHasPassword,
  destroyAllUserSessions,
  destroyCurrentSession,
  requireUser,
} from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { serializeUser } from '@/lib/serialize';
import { updateProfileSchema } from '@/lib/validation/profile';
import { setLocaleCookie } from '@/i18n/locale';

export const GET = apiHandler(async () => {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw Errors.unauthorized();
  const hasPassword = await currentUserHasPassword();
  return ok(serializeUser(user, hasPassword));
});

export const PATCH = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const sessionUser = await requireUser();
  const input = await parseBody(req, updateProfileSchema);

  const user = await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.notifyExpenseEmail !== undefined
        ? { notifyExpenseEmail: input.notifyExpenseEmail }
        : {}),
      ...(input.notifyReminderEmail !== undefined
        ? { notifyReminderEmail: input.notifyReminderEmail }
        : {}),
      ...(input.notifyInviteEmail !== undefined
        ? { notifyInviteEmail: input.notifyInviteEmail }
        : {}),
      ...(input.notifyCommentEmail !== undefined
        ? { notifyCommentEmail: input.notifyCommentEmail }
        : {}),
      ...(input.notifyInApp !== undefined ? { notifyInApp: input.notifyInApp } : {}),
    },
  });

  if (input.locale) await setLocaleCookie(input.locale);

  return ok(serializeUser(user, Boolean(user.passwordHash)));
});

export const DELETE = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      email: `deleted+${user.id}@deleted.invalid`,
      name: 'Deleted user',
      passwordHash: null,
      image: null,
    },
  });

  await destroyAllUserSessions(user.id);
  await destroyCurrentSession();

  return ok({ success: true });
});
