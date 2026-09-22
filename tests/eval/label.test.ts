import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { labelSchema, labelsSchema, loadLabels } from '../../src/eval/label.js';

const label = {
  pagePath: 'pages/pricing.html',
  lockId: 'footer-legal',
  rule: 'content',
  domPath: 'body/main[1]/footer[3]',
};

describe('the label schema', () => {
  it('accepts an array of hand-written labels', () => {
    expect(labelsSchema.parse([label])).toEqual([label]);
  });

  it('accepts an empty array, which is how a control page carries no label', () => {
    expect(labelsSchema.parse([])).toEqual([]);
  });

  it.each(['pagePath', 'lockId', 'rule', 'domPath'])('requires %s', (field) => {
    const { [field]: _removed, ...incomplete } = label as Record<string, unknown>;
    expect(labelSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(labelSchema.safeParse({ ...label, severity: 'high' }).success).toBe(false);
  });

  it.each(['pagePath', 'lockId', 'domPath'])('rejects a blank %s', (field) => {
    expect(labelSchema.safeParse({ ...label, [field]: '   ' }).success).toBe(false);
  });

  it.each(['content', 'appearance', 'position', 'structural_ambiguity'])('accepts the %s rule', (rule) => {
    expect(labelSchema.parse({ ...label, rule })).toEqual({ ...label, rule });
  });

  it('rejects a rule outside the shared enum', () => {
    expect(labelSchema.safeParse({ ...label, rule: 'layout' }).success).toBe(false);
  });
});

describe('label file loading', () => {
  let directory: string;
  let labelsFilePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'eval-labels-'));
    labelsFilePath = join(directory, 'labels.json');
    await writeFile(labelsFilePath, JSON.stringify([label]));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads and validates the labels file', async () => {
    expect(await loadLabels(labelsFilePath)).toEqual([label]);
  });

  it('throws on a missing labels file', async () => {
    await expect(loadLabels(join(directory, 'missing.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('throws on malformed JSON', async () => {
    await writeFile(labelsFilePath, '[ malformed');
    await expect(loadLabels(labelsFilePath)).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    { labels: [label] },
    [{ ...label, rule: 'layout' }],
    [{ ...label, unexpected: true }],
  ])('throws on a schema violation: %j', async (invalid) => {
    await writeFile(labelsFilePath, JSON.stringify(invalid));
    await expect(loadLabels(labelsFilePath)).rejects.toBeInstanceOf(ZodError);
  });
});
