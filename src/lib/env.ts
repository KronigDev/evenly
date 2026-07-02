/**
 * Validated, typed server environment. Import only from server code
 * (route handlers, server components, scripts).
 */

import { z } from 'zod';

const stringBool = (def: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === '') return def;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return Boolean(v);
  }, z.boolean());

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  AUTH_SECRET: z
    .string()
    .min(16, 'AUTH_SECRET must be at least 16 characters')
    .default('dev-only-insecure-secret-change-me-0123456789abcdef'),
  // Empty SMTP_HOST => email features are disabled.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_SECURE: stringBool(false),
  EMAIL_FROM: z.string().default('Evenly <no-reply@evenly.local>'),
  // Live FX provider — defaults to ExchangeRate-API's free open endpoint
  // (no key required). "off" disables external calls (bundled rates are used).
  EXCHANGE_RATE_API_URL: z.preprocess((v) => {
    if (v === undefined || v === '') return 'https://open.er-api.com/v6/latest/USD';
    if (typeof v === 'string' && v.toLowerCase() === 'off') return '';
    return v;
  }, z.string()),
  EXCHANGE_RATE_API_KEY: z.string().optional().default(''),
  UPLOAD_DIR: z.string().default('./uploads'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});

/** Public app URL, safe to use on the client (inlined by Next at build time). */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
