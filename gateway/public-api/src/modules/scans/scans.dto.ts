import { z } from 'zod';
import { SCAN_MODES } from '@x-hunter/shared';

export const CreateScanBody = z.object({
  authorizationId: z.string(),
  mode: z.enum(SCAN_MODES),
});

export type CreateScanBody = z.infer<typeof CreateScanBody>;
