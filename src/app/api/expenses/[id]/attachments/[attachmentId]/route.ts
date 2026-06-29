import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { requireExpenseAccess } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { apiHandler, Errors, noContent } from '@/lib/http';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string; attachmentId: string }>;
}

export const DELETE = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id, attachmentId } = await params;
  await assertCsrf(req);
  await requireExpenseAccess(id);

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, expenseId: id },
  });
  if (!attachment) throw Errors.notFound('Attachment not found.');

  await prisma.attachment.delete({ where: { id: attachment.id } });

  // Best-effort removal of the stored file; ignore if it is already gone.
  try {
    await unlink(path.join(env.UPLOAD_DIR, attachment.storageKey));
  } catch {
    // ignore
  }

  return noContent();
});
