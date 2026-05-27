import { z } from 'zod';
import { SCAN_PACKAGES } from '@x-hunter/shared';

export const CreateScanBody = z.object({
  authorizationId: z.string(),
  mode: z.enum(SCAN_PACKAGES),
});

export type CreateScanBody = z.infer<typeof CreateScanBody>;
