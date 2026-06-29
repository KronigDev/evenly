import { z } from 'zod';
import { currencyCode, cuid, dateInput } from './common';

export const createSettlementSchema = z
  .object({
    fromMemberId: cuid,
    toMemberId: cuid,
    amount: z.number().int().positive('Enter an amount greater than zero.'), // base minor units
    currency: currencyCode.optional(),
    date: dateInput.optional(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.fromMemberId !== v.toMemberId, {
    message: 'Payer and recipient must differ.',
    path: ['toMemberId'],
  });

export const remindSchema = z.object({
  memberId: cuid,
});
