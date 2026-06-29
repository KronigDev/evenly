import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  displayName: z.string().trim().min(1).max(80).optional().nullable(),
});

/** Add a placeholder member by name only (no email / no invite). */
export const addPlaceholderSchema = z.object({
  name: z.string().trim().min(1, 'A name is required.').max(80),
});

export const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
});
