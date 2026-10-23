import { z } from 'zod';

export const CreateScanBody = z.object({
  authorizationId: z.string(),
  acceptanceProfile: z.enum(['standard', 'canary_e2e']).default('standard'),
  acceptedCoverageGaps: z.array(z.string().max(160)).max(10).default([]),
});

export type CreateScanBody = z.infer<typeof CreateScanBody>;
