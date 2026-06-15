import { z } from 'zod';

export const DecisionBody = z.object({
  decision: z.enum(['approved', 'denied']),
  reason: z.string().max(500).optional(),
});

export type DecisionBody = z.infer<typeof DecisionBody>;
