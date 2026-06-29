import { assertCsrf } from '@/lib/auth/csrf';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { apiHandler, Errors, ok, parseBody } from '@/lib/http';
import { changePasswordSchema } from '@/lib/validation/profile';

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) throw Errors.unauthorized();

  if (row.passwordHash) {
    if (!currentPassword) {
      throw Errors.badRequest('Enter your current password.');
    }
    const valid = await verifyPassword(row.passwordHash, currentPassword);
    if (!valid) throw Errors.badRequest('Your current password is incorrect.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return ok({ success: true });
});
