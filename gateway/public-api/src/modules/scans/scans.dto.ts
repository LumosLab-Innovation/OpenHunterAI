import { z } from 'zod';

export const CreateScanBody = z.object({
  authorizationId: z.string(),
  mode: z.enum(['free', 'light', 'standard', 'auth']),
});

export type CreateScanBody = z.infer<typeof CreateScanBody>;
