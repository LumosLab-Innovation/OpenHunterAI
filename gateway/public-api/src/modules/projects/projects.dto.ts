import { z } from 'zod';

export const CreateProjectBody = z.object({
  name: z.string().min(1).max(128),
  packageTier: z.enum(['free', 'light', 'standard', 'auth', 'launch']).default('free'),
});

export type CreateProjectBody = z.infer<typeof CreateProjectBody>;
