import { z } from 'zod';
import { checkerSchema } from './checker.js';
import { confidenceSchema } from './confidence.js';
import { domPathSchema, lockIdSchema, pagePathSchema } from './identity.js';
import { ruleSchema } from './rule.js';
import { verdictSchema } from './verdict.js';

const checkerRules = {
  presence_precondition: 'structural_ambiguity',
  deterministic_content_normalizer: 'content',
  playwright_appearance_proxy: 'appearance',
  relational_position_anchor: 'position',
  deterministic_content_normalizer_llm_judge: 'content',
  playwright_appearance_proxy_llm_judge: 'appearance',
} as const;

export const findingSchema = z.strictObject({
  lockId: lockIdSchema,
  rule: ruleSchema,
  pagePath: pagePathSchema,
  domPath: domPathSchema,
  verdict: verdictSchema,
  confidence: confidenceSchema,
  reason: z.string().refine((value) => value.trim().length > 0, {
    message: 'Must contain a reason',
  }),
  checker: checkerSchema,
}).superRefine((finding, context) => {
  const reject = (field: keyof typeof finding, message: string) => {
    context.addIssue({ code: 'custom', path: [field], message });
  };

  if (finding.rule !== checkerRules[finding.checker]) {
    reject('rule', 'Rule must match its checker');
  }

  const judged = finding.checker.endsWith('_llm_judge');
  if (!judged) {
    if (finding.confidence !== null) {
      reject('confidence', 'Deterministic findings require null confidence');
    }
    if (finding.verdict === 'needs_review') {
      reject('verdict', 'Only the structural judge can return needs_review');
    }
  } else if (/[\r\n]/u.test(finding.reason)) {
    reject('reason', 'Judge reasons must be one line');
  }

  if (finding.checker === 'presence_precondition') {
    if (finding.verdict !== 'fail') {
      reject('verdict', 'A missing lock must fail');
    }
    if (finding.domPath !== 'NOT_FOUND') {
      reject('domPath', 'A missing lock must use NOT_FOUND');
    }
  }
});

export type Finding = z.infer<typeof findingSchema>;
