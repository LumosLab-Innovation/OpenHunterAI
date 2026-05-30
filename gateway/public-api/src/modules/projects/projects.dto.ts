import { z } from 'zod';
import { COMMERCIAL_PACKAGES } from '@x-hunter/shared';

export const CreateProjectBody = z.object({
  name: z.string().min(1).max(128),
  packageTier: z.enum(COMMERCIAL_PACKAGES).default('free_hunter'),
});

export type CreateProjectBody = z.infer<typeof CreateProjectBody>;
