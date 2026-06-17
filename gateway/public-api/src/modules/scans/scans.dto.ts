import { z } from 'zod';

export const CreateScanBody = z.object({
  authorizationId: z.string(),
  acceptanceProfile: z.enum(['standard', 'canary_e2e']).default('standard'),
});

export type CreateScanBody = z.infer<typeof CreateScanBody>;
