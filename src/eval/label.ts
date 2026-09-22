import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { domPathSchema, lockIdSchema, pagePathSchema } from '../findings/identity.js';
import { ruleSchema } from '../findings/rule.js';

export const labelSchema = z.strictObject({
  pagePath: pagePathSchema,
  lockId: lockIdSchema,
  rule: ruleSchema,
  domPath: domPathSchema,
});

export type EvalLabel = z.infer<typeof labelSchema>;

export const labelsSchema = z.array(labelSchema);

export async function loadLabels(labelsFilePath: string): Promise<EvalLabel[]> {
  const source = await readFile(resolve(labelsFilePath), 'utf8');
  const parsed: unknown = JSON.parse(source);
  return labelsSchema.parse(parsed);
}
