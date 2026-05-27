import { z } from 'zod';

export const CreateDomainBody = z.object({
  hostname: z.string().min(3).max(253),
});

export type CreateDomainBody = z.infer<typeof CreateDomainBody>;
