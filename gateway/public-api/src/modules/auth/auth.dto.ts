import { z } from 'zod';

export const SignUpBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(64).optional(),
  orgName: z.string().min(1).max(64),
});

export const SignInBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export type SignUpBody = z.infer<typeof SignUpBody>;
export type SignInBody = z.infer<typeof SignInBody>;
