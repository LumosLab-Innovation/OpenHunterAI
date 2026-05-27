import { z } from 'zod';
import { SCAN_PACKAGES } from '@x-hunter/shared';

export const CreateAuthorizationBody = z.object({
  scanPackage: z.enum(SCAN_PACKAGES),
  allowedHosts: z.array(z.string().min(1)),
  allowedPaths: z.array(z.string()).default([]),
  excludedPaths: z.array(z.string()).default([]),
  testAccountPermission: z.boolean().default(false),
  sensitiveActionPermission: z.boolean().default(false),
  consentText: z.string().min(10).max(4096),
});

export type CreateAuthorizationBody = z.infer<typeof CreateAuthorizationBody>;
