import { z } from 'zod';

export const verdictSchema = z.enum(['pass', 'fail', 'needs_review']);

export type Verdict = z.infer<typeof verdictSchema>;
