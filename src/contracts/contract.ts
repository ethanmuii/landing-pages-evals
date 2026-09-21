import { z } from 'zod';
import { lockIdSchema, pagePathSchema } from '../findings/identity.js';

export const baselinePathSchema = pagePathSchema;

export const policySchema = z.strictObject({
  content: z.literal(true),
  appearance: z.literal(true),
  position: z.literal(true),
});

export const lockSchema = z.strictObject({
  lockId: lockIdSchema,
  baselinePath: baselinePathSchema,
  policy: policySchema,
});

export const contractSchema = z.array(lockSchema);

export type LockPolicy = z.infer<typeof policySchema>;
export type Lock = z.infer<typeof lockSchema>;
export type BrandContract = z.infer<typeof contractSchema>;
