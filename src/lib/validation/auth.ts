import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');
export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'That password is too long.');
export const nameSchema = z.string().trim().min(1, 'Your name is required.').max(80);
export const localeSchema = z.enum(['en', 'de']);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  locale: localeSchema.optional(),
  // Raw group-invite token — authorizes registration when self sign-up is
  // disabled (REGISTRATION_ENABLED=false). Validated server-side.
  inviteToken: z.string().min(1).max(200).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const magicLinkSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});
