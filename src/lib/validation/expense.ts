import { z } from 'zod';
import { categoryKey, currencyCode, cuid, dateInput } from './common';

const splitMethodEnum = z.enum([
  'EQUAL',
  'EXACT',
  'PERCENTAGE',
  'SHARES',
  'ADJUSTMENT',
  'ITEMIZED',
]);

/** A payer's contribution, in ENTRY-currency minor units. */
const payerInput = z.object({
  memberId: cuid,
  amount: z.number().int().nonnegative(),
});

/** A member's split participation. `value` meaning depends on splitMethod
 *  (EXACT=entry minor units, PERCENTAGE=percent, SHARES=weight,
 *  ADJUSTMENT=entry minor units +/-). */
const splitInput = z.object({
  memberId: cuid,
  value: z.number().optional(),
  included: z.boolean().optional(),
});

const itemInput = z.object({
  description: z.string().trim().max(140).default(''),
  amount: z.number().int().nonnegative(), // entry-currency minor units
  memberIds: z.array(cuid).min(1),
});

const recurringInput = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  interval: z.number().int().min(1).max(52).default(1),
  endDate: dateInput.optional().nullable(),
});

export const createExpenseSchema = z
  .object({
    description: z.string().trim().min(1, 'A description is required.').max(140),
    amount: z.number().int().nonnegative(), // total, entry-currency minor units
    currency: currencyCode,
    category: categoryKey.default('general'),
    note: z.string().trim().max(2000).optional().nullable(),
    date: dateInput,
    splitMethod: splitMethodEnum,
    payers: z.array(payerInput).min(1, 'At least one payer is required.'),
    splits: z.array(splitInput).optional(),
    items: z.array(itemInput).optional(),
    recurring: recurringInput.optional().nullable(),
  })
  .refine((v) => v.splitMethod === 'ITEMIZED' || (v.splits && v.splits.length > 0), {
    message: 'A split configuration is required.',
    path: ['splits'],
  })
  .refine((v) => v.splitMethod !== 'ITEMIZED' || (v.items && v.items.length > 0), {
    message: 'At least one item is required for an itemized split.',
    path: ['items'],
  });

export const updateExpenseSchema = createExpenseSchema;

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
