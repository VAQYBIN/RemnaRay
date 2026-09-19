import { z } from 'zod';

export const planIdSchema = z.object({ planId: z.uuid() });

export type SubscriptionPlanInput = z.infer<typeof planIdSchema>;
