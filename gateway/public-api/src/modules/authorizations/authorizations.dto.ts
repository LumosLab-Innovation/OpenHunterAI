import { z } from 'zod';
import {
  AUTH_SCOPES,
  DEFAULT_SURFACE_FLAGS,
  SCAN_MODES,
  TARGET_TYPES,
  TEST_INTENSITY_MODES,
} from '@x-hunter/shared';

const SurfaceFlagsSchema = z
  .object({
    has_login: z.boolean().default(false),
    has_test_account: z.boolean().default(false),
    has_api_docs: z.boolean().default(false),
    has_file_upload: z.boolean().default(false),
    has_payment: z.boolean().default(false),
    has_admin_dashboard: z.boolean().default(false),
    has_webhook: z.boolean().default(false),
    has_chatbot_or_rag_or_tool_calling: z.boolean().default(false),
  })
  .default(DEFAULT_SURFACE_FLAGS);

export const CreateAuthorizationBody = z.object({
  scanMode: z.enum(SCAN_MODES),
  authScope: z.enum(AUTH_SCOPES).default('none'),
  targetType: z.enum(TARGET_TYPES),
  testIntensityMode: z.enum(TEST_INTENSITY_MODES).default('safe_discovery'),
  surfaceFlags: SurfaceFlagsSchema,
  aggressiveStagingRiskAccepted: z.boolean().default(false),
  allowedHosts: z.array(z.string().min(1)),
  allowedPaths: z.array(z.string()).default([]),
  excludedPaths: z.array(z.string()).default([]),
  testAccountPermission: z.boolean().optional(),
  sensitiveActionPermission: z.boolean().optional(),
  consentText: z.string().min(10).max(4096),
});

export type CreateAuthorizationBody = z.infer<typeof CreateAuthorizationBody>;
