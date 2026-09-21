import { z } from 'zod';

export const confidenceSchema = z.number().min(0).max(1).nullable();

export type Confidence = z.infer<typeof confidenceSchema>;
