/** Client-side fetch wrapper: injects the CSRF header, unwraps `{data}`,
 *  and throws a typed error carrying the API error code. */

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };

  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  if (method !== 'GET') {
    const csrf = readCookie('evenly_csrf');
    if (csrf) headers['x-evenly-csrf'] = csrf;
  }

  const res = await fetch(path, {
    method,
    headers,
    body,
    signal: opts.signal,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { code: string; message: string; details?: unknown };
  } | null;

  if (!res.ok) {
    const err = json?.error;
    throw new ApiClientError(
      err?.message ?? 'Request failed.',
      err?.code ?? 'ERROR',
      res.status,
      err?.details,
    );
  }
  return (json?.data ?? (json as T)) as T;
}
