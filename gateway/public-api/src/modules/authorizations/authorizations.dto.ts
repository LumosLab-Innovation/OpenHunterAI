import { z } from 'zod';
import { SCAN_MODES } from '@x-hunter/shared';

export const CreateAuthorizationBody = z.object({
  scanMode: z.enum(SCAN_MODES),
  authScope: z.enum(['none', 'one_account', 'two_accounts']).default('none'),
  allowedHosts: z.array(z.string().min(1)),
  allowedPaths: z.array(z.string()).default([]),
  excludedPaths: z.array(z.string()).default([]),
  testAccountPermission: z.boolean().default(false),
  sensitiveActionPermission: z.boolean().default(false),
  consentText: z.string().min(10).max(4096),
});

export type CreateAuthorizationBody = z.infer<typeof CreateAuthorizationBody>;
