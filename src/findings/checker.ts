import { z } from 'zod';

export const checkerSchema = z.enum([
  'presence_precondition',
  'deterministic_content_normalizer',
  'playwright_appearance_proxy',
  'relational_position_anchor',
  'deterministic_content_normalizer_llm_judge',
  'playwright_appearance_proxy_llm_judge',
]);

export type Checker = z.infer<typeof checkerSchema>;
