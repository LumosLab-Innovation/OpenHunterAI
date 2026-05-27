import { z } from 'zod';
import { SCAN_PACKAGES } from '@x-hunter/shared';

export const CreateProjectBody = z.object({
  name: z.string().min(1).max(128),
  packageTier: z.enum(SCAN_PACKAGES).default('free_hunter_snapshot'),
});

export type CreateProjectBody = z.infer<typeof CreateProjectBody>;
