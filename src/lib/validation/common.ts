import { z } from 'zod';
import { CURRENCY_CODES } from '@/lib/currency';
import { CATEGORY_KEYS } from '@/lib/categories';

export const currencyCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((c) => CURRENCY_CODES.includes(c), { message: 'Unsupported currency.' });

export const categoryKey = z
  .string()
  .refine((c) => CATEGORY_KEYS.includes(c), { message: 'Unknown category.' });

export const cuid = z.string().min(1);

/** Coerce ISO strings / Date into a Date. */
export const dateInput = z.coerce.date();
