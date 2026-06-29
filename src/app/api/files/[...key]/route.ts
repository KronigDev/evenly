import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { apiHandler, Errors } from '@/lib/http';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ key: string[] }>;
}

const EXTENSION_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
};

function inferContentType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return EXTENSION_TYPES[ext] ?? 'application/octet-stream';
}

export const GET = apiHandler(async (_req: Request, { params }: RouteContext) => {
  await requireUser();

  const { key } = await params;
  const name = key.join('/');

  // Storage keys are single, unguessable filenames. Reject anything that could
  // escape the upload directory.
  if (name.includes('..') || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw Errors.notFound('File not found.');
  }

  let data: Buffer;
  try {
    data = await readFile(path.join(env.UPLOAD_DIR, name));
  } catch {
    throw Errors.notFound('File not found.');
  }

  const attachment = await prisma.attachment.findFirst({
    where: { storageKey: name },
    select: { mimeType: true },
  });
  const contentType = attachment?.mimeType ?? inferContentType(name);

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Cache-Control': 'private, max-age=86400',
    },
  });
});
