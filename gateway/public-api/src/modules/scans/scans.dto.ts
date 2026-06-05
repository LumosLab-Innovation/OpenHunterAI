import { z } from 'zod';

export const CreateScanBody = z.object({
  authorizationId: z.string(),
});

export type CreateScanBody = z.infer<typeof CreateScanBody>;
