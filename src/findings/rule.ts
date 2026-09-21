import { z } from 'zod';

export const ruleSchema = z.enum([
  'content',
  'appearance',
  'position',
  'structural_ambiguity',
]);

export type Rule = z.infer<typeof ruleSchema>;
