import { describe, expect, it } from 'vitest';
import type { JudgeConfig } from '../../src/judge/config.js';
import { buildStructuralJudgeRequest } from '../../src/judge/request.js';
import { STRUCTURAL_JUDGE_RUBRIC } from '../../src/judge/rubric.js';

const config: JudgeConfig = { model: 'my-model', maxTokens: 1234 };

const expectedContent = (baselineHtml: string, generatedHtml: string) =>
  `<baseline_subtree>\n${baselineHtml}\n</baseline_subtree>\n\n<generated_subtree>\n${generatedHtml}\n</generated_subtree>`;

describe('request shape', () => {
  const request = buildStructuralJudgeRequest({ baselineHtml: '<a></a>', generatedHtml: '<b></b>' }, config);

  it('has exactly the decided keys', () => {
    expect(Object.keys(request).sort()).toEqual(['max_tokens', 'messages', 'model', 'output_config', 'system']);
  });

  it('takes model and max_tokens from the config', () => {
    expect(request.model).toBe('my-model');
    expect(request.max_tokens).toBe(1234);
  });

  it('uses the rubric as a plain string system prompt', () => {
    expect(request.system).toBe(STRUCTURAL_JUDGE_RUBRIC);
  });

  it('sends a single user message', () => {
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0]?.role).toBe('user');
    expect(request.messages[0]?.content).toBe(expectedContent('<a></a>', '<b></b>'));
  });

  it.each(['thinking', 'temperature', 'tools', 'tool_choice', 'effort'])('omits %s', (key) => {
    expect(request).not.toHaveProperty(key);
  });
});

describe('output format', () => {
  const request = buildStructuralJudgeRequest({ baselineHtml: '', generatedHtml: '' }, config);

  it('constrains the response to the strict verdict schema', () => {
    const format = request.output_config?.format;
    expect(format).toBeDefined();
    expect(format?.type).toBe('json_schema');
    expect(format?.schema).toMatchObject({ additionalProperties: false });
    expect(format?.schema.required).toEqual(expect.arrayContaining(['verdict', 'confidence', 'reason']));
  });

  it('does not set an effort level', () => {
    expect(request.output_config).not.toHaveProperty('effort');
  });
});

describe('verbatim fragments', () => {
  it.each([
    ['leading and trailing whitespace', '  \n<div>\n  ', '\t<div></div>\n\n'],
    ['quotes', '<a title="say \'hi\'">', '<a title=\'say "hi"\'>'],
    ['script text', '<script>if (a < b && c > d) alert("x");</script>', '<script>let s = "</script>";</script>'],
    ['non-ASCII', '<p>Héllo wörld — 日本語 🚀</p>', '<p>Ünïcödé ✓</p>'],
  ])('embeds fragments with %s untouched', (_label, baselineHtml, generatedHtml) => {
    const request = buildStructuralJudgeRequest({ baselineHtml, generatedHtml }, config);
    expect(request.messages[0]?.content).toBe(expectedContent(baselineHtml, generatedHtml));
  });
});

describe('corpus isolation', () => {
  it.each(['label', 'mutation', 'clean'])('does not mention %j when the fragments do not', (word) => {
    const request = buildStructuralJudgeRequest({ baselineHtml: '<a></a>', generatedHtml: '<b></b>' }, config);
    expect(JSON.stringify(request)).not.toMatch(new RegExp(`(?<![\\w-])${word}(?![\\w-])`, 'u'));
  });
});
