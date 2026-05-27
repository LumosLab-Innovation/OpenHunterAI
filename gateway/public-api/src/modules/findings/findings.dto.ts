import { z } from 'zod';

export const StatusChangeBody = z.object({
  status: z.enum(['open', 'in_progress', 'ready_for_retest', 'fixed', 'still_vulnerable', 'accepted_risk']),
  reason: z.string().max(2048).optional(),
});

export type StatusChangeBody = z.infer<typeof StatusChangeBody>;
