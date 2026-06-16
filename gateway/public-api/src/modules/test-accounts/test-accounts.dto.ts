import { z } from 'zod';

export const CreateTestAccountBody = z.object({
  label: z.string().min(1).max(80),
  loginUrl: z.string().url().max(2048),
  username: z.string().max(256).optional(),
  password: z.string().max(512).optional(),
  notes: z.string().max(1024).optional(),
});

export type CreateTestAccountBody = z.infer<typeof CreateTestAccountBody>;
