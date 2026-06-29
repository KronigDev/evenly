/** API response + error helpers shared by every route handler. */

import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (message = 'Invalid request', details?: unknown) =>
    new ApiError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'You must be signed in.') => new ApiError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have access to this resource.') =>
    new ApiError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found.') => new ApiError(404, 'NOT_FOUND', message),
  conflict: (message = 'Conflict.', details?: unknown) =>
    new ApiError(409, 'CONFLICT', message, details),
  validation: (message = 'Validation failed.', details?: unknown) =>
    new ApiError(422, 'VALIDATION', message, details),
  rateLimited: (message = 'Too many requests. Please try again shortly.', retryAfter?: number) =>
    new ApiError(429, 'RATE_LIMITED', message, { retryAfter }),
  internal: (message = 'Something went wrong.') => new ApiError(500, 'INTERNAL', message),
};

/** Success body: the resource is returned under `data`. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(err: ApiError): NextResponse {
  const headers: Record<string, string> = {};
  if (err.status === 429 && err.details && typeof err.details === 'object') {
    const retryAfter = (err.details as { retryAfter?: number }).retryAfter;
    if (retryAfter) headers['Retry-After'] = String(Math.ceil(retryAfter / 1000));
  }
  return NextResponse.json(
    { error: { code: err.code, message: err.message, details: err.details } },
    { status: err.status, headers },
  );
}

/**
 * Wrap a route handler so thrown ApiError / ZodError become structured JSON
 * responses and unexpected errors become a logged 500.
 */
export function apiHandler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      if (err instanceof ZodError) {
        return errorResponse(Errors.validation('Validation failed.', err.flatten()));
      }
      console.error('[api] unhandled error:', err);
      return errorResponse(Errors.internal());
    }
  };
}

/** Parse and validate a JSON body, throwing a 422 on mismatch. */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw Errors.badRequest('Expected a JSON body.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw Errors.validation('Validation failed.', parsed.error.flatten());
  }
  return parsed.data;
}

/** Parse and validate URL search params. */
export function parseQuery<S extends ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S,
): z.infer<S> {
  const obj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) obj[key] = value;
  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    throw Errors.validation('Invalid query parameters.', parsed.error.flatten());
  }
  return parsed.data;
}
