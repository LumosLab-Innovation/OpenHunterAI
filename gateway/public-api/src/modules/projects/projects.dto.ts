import { z } from 'zod';

export const CreateProjectBody = z.object({
  name: z.string().min(1).max(128),
});

export const DeleteProjectBody = z.object({
  confirmName: z.string().min(1).max(128),
});

export type CreateProjectBody = z.infer<typeof CreateProjectBody>;
export type DeleteProjectBody = z.infer<typeof DeleteProjectBody>;
