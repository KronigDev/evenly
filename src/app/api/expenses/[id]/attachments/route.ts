import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AttachmentDTO } from '@/lib/api/types';
import { requireExpenseAccess } from '@/lib/auth/authz';
import { assertCsrf } from '@/lib/auth/csrf';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { apiHandler, created, Errors } from '@/lib/http';
import { fileUrl } from '@/lib/serialize';

export const runtime = 'nodejs';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isAllowedType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

/** Keep only a short, safe extension (e.g. ".png"); otherwise drop it. */
function safeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

export const POST = apiHandler(async (req: Request, { params }: RouteContext) => {
  const { id } = await params;
  await assertCsrf(req);
  const { user } = await requireExpenseAccess(id);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.badRequest('Expected a multipart form upload.');
  }

  const file = form.get('file');
  if (!(file instanceof File)) throw Errors.badRequest('A file is required.');
  if (file.size <= 0) throw Errors.badRequest('The file is empty.');
  if (file.size > MAX_BYTES) throw Errors.badRequest('The file is too large (max 8 MB).');
  if (!isAllowedType(file.type)) {
    throw Errors.badRequest('Only image or PDF files are allowed.');
  }

  const storageKey = `${randomUUID()}${safeExtension(file.name)}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(env.UPLOAD_DIR, storageKey), bytes);

  const attachment = await prisma.attachment.create({
    data: {
      expenseId: id,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      size: file.size,
      storageKey,
      uploadedById: user.id,
    },
  });

  const dto: AttachmentDTO = {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: fileUrl(storageKey),
  };

  return created(dto);
});
