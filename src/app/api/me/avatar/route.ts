import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { assertCsrf } from '@/lib/auth/csrf';
import { currentUserHasPassword, requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { apiHandler, created, Errors } from '@/lib/http';
import { serializeUser } from '@/lib/serialize';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 4 * 1024 * 1024;

export const POST = apiHandler(async (req: Request) => {
  await assertCsrf(req);
  const user = await requireUser();

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw Errors.badRequest('No file provided.');
  if (file.size > MAX_BYTES) throw Errors.badRequest('Image must be 4MB or smaller.');
  if (!ALLOWED.has(file.type))
    throw Errors.badRequest('Only PNG, JPEG, WEBP or GIF images are allowed.');

  const ext =
    extname(file.name)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '') || '.png';
  const storageKey = `${randomUUID()}${ext}`;
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await writeFile(join(env.UPLOAD_DIR, storageKey), Buffer.from(await file.arrayBuffer()));

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { image: storageKey },
  });

  return created(serializeUser(updated, await currentUserHasPassword()));
});
