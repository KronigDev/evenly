import { z } from 'zod';
import { currencyCode } from './common';

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'A group name is required.').max(80),
  description: z.string().trim().max(500).optional().nullable(),
  emoji: z.string().trim().max(8).optional().nullable(),
  color: z.string().trim().max(24).optional().nullable(),
  baseCurrency: currencyCode.default('EUR'),
  simplifyDebts: z.boolean().default(true),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  emoji: z.string().trim().max(8).optional().nullable(),
  color: z.string().trim().max(24).optional().nullable(),
  baseCurrency: currencyCode.optional(),
  simplifyDebts: z.boolean().optional(),
  archived: z.boolean().optional(),
});

/** Create a 1:1 direct balance with a friend (by email or name). */
export const createDirectSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    name: z.string().trim().min(1).max(80).optional(),
    baseCurrency: currencyCode.default('EUR'),
  })
  .refine((v) => v.email || v.name, { message: 'Provide an email or a name.' });

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
