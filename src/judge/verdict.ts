import { z } from 'zod';

export const judgeOutputSchema = z.strictObject({
  verdict: z.enum(['pass', 'fail']),
  confidence: z.number().min(0).max(1),
  reason: z.string()
    .refine((value) => value.trim().length > 0, { message: 'Must contain a reason' })
    .refine((value) => !/[\r\n]/u.test(value), { message: 'Judge reasons must be one line' }),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;
