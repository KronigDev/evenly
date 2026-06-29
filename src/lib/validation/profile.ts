import { z } from 'zod';
import { currencyCode } from './common';
import { nameSchema, passwordSchema } from './auth';

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  image: z.string().max(300).optional().nullable(),
  defaultCurrency: currencyCode.optional(),
  locale: z.enum(['en', 'de']).optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  notifyExpenseEmail: z.boolean().optional(),
  notifyReminderEmail: z.boolean().optional(),
  notifyInviteEmail: z.boolean().optional(),
  notifyCommentEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first.').max(1000),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
