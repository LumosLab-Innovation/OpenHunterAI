import { z } from 'zod';

export const CreateTestAccountBody = z.object({
  label: z.string().min(1).max(80),
  loginUrl: z.string().url().max(2048),
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(512),
  notes: z.string().max(1024).optional(),
});

export type CreateTestAccountBody = z.infer<typeof CreateTestAccountBody>;
