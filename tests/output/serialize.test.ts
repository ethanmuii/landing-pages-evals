import { describe, expect, it } from 'vitest';
import { findingSchema, type Finding } from '../../src/findings/finding.js';
import type { Rule } from '../../src/findings/rule.js';
import { serializeFindings } from '../../src/output/serialize.js';

const CHECKER_FOR_RULE = {
  content: 'deterministic_content_normalizer',
  appearance: 'playwright_appearance_proxy',
  position: 'relational_position_anchor',
  structural_ambiguity: 'presence_precondition',
} as const;

type Parts = {
  lockId?: string;
  rule?: Rule;
  pagePath?: string;
  reason?: string;
};

function finding(parts: Parts = {}): Finding {
  const rule = parts.rule ?? 'content';
  const missing = rule === 'structural_ambiguity';
  return findingSchema.parse({
    lockId: parts.lockId ?? 'hero',
    rule,
    pagePath: parts.pagePath ?? 'a.html',
    domPath: missing ? 'NOT_FOUND' : 'main > h1',
    verdict: missing ? 'fail' : 'pass',
    confidence: null,
    checker: CHECKER_FOR_RULE[rule],
    reason: parts.reason ?? 'Checked.',
  });
}

const identity = (finding: Finding) => `${finding.pagePath}|${finding.lockId}|${finding.rule}`;
const orderOf = (json: string): string[] => (JSON.parse(json) as Finding[]).map(identity);

const RULES: readonly Rule[] = ['content', 'appearance', 'position', 'structural_ambiguity'];

describe('the serialized shape', () => {
  it('parses back to an array equal to the findings', () => {
    const findings = [
      finding({ lockId: 'hero', pagePath: 'a.html' }),
      finding({ lockId: 'hero', pagePath: 'b.html' }),
    ];
    expect(JSON.parse(serializeFindings(findings, ['hero']))).toEqual(findings);
  });

  it('emits a bare array, not a wrapper object', () => {
    const out = serializeFindings([finding()], ['hero']);
    expect(Array.isArray(JSON.parse(out))).toBe(true);
    expect(out.startsWith('[')).toBe(true);
  });

  it('keeps the eight keys in the declared order', () => {
    const out = serializeFindings([finding()], ['hero']);
    expect(Object.keys((JSON.parse(out) as Finding[])[0]!)).toEqual([
      'lockId',
      'rule',
      'pagePath',
      'domPath',
      'verdict',
      'confidence',
      'reason',
      'checker',
    ]);
  });

  it('ends with a trailing newline and indents by two spaces', () => {
    const out = serializeFindings([finding()], ['hero']);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
    const lines = out.split('\n');
    expect(lines[0]).toBe('[');
    expect(lines[1]).toBe('  {');
    expect(lines[2]).toBe('    "lockId": "hero",');
  });

  it('serializes an empty array', () => {
    expect(serializeFindings([], ['hero'])).toBe('[]\n');
  });
});

describe('ordering', () => {
  const lockOrder = ['zulu', 'alpha', 'mike'];
  const shuffled = ['b.html', 'a.html'].flatMap((pagePath) =>
    ['alpha', 'mike', 'zulu'].flatMap((lockId) =>
      ['structural_ambiguity', 'position', 'appearance', 'content'].map((rule) =>
        finding({ pagePath, lockId, rule: rule as Rule }))));

  const expected = ['a.html', 'b.html'].flatMap((pagePath) =>
    lockOrder.flatMap((lockId) => RULES.map((rule) => `${pagePath}|${lockId}|${rule}`)));

  it('sorts by page, then contract lock order, then rule', () => {
    expect(orderOf(serializeFindings(shuffled, lockOrder))).toEqual(expected);
  });

  it('sorts pages by plain code units', () => {
    const findings = [
      finding({ pagePath: 'a.html' }),
      finding({ pagePath: 'B.html' }),
      finding({ pagePath: 'A.html' }),
    ];
    expect(orderOf(serializeFindings(findings, ['hero']))).toEqual([
      'A.html|hero|content',
      'B.html|hero|content',
      'a.html|hero|content',
    ]);
  });

  it('follows the contract lock order rather than the alphabet', () => {
    const findings = [finding({ lockId: 'alpha' }), finding({ lockId: 'zulu' })];
    expect(orderOf(serializeFindings(findings, ['zulu', 'alpha']))).toEqual([
      'a.html|zulu|content',
      'a.html|alpha|content',
    ]);
  });

  it('sorts structural_ambiguity last among the rules', () => {
    const findings = RULES.toReversed().map((rule) => finding({ rule }));
    expect(orderOf(serializeFindings(findings, ['hero']))).toEqual(
      RULES.map((rule) => `a.html|hero|${rule}`),
    );
  });

  it('puts a lockId absent from the contract after every known lock', () => {
    const findings = [finding({ lockId: 'stray' }), finding({ lockId: 'hero' })];
    expect(orderOf(serializeFindings(findings, ['hero']))).toEqual([
      'a.html|hero|content',
      'a.html|stray|content',
    ]);
  });

  it('sorts two unknown locks by lockId ascending', () => {
    const findings = [
      finding({ lockId: 'wanderer' }),
      finding({ lockId: 'stray' }),
      finding({ lockId: 'hero' }),
    ];
    expect(orderOf(serializeFindings(findings, ['hero']))).toEqual([
      'a.html|hero|content',
      'a.html|stray|content',
      'a.html|wanderer|content',
    ]);
  });

  it('still sorts unknown locks by rule when the lockId ties', () => {
    const findings = [finding({ lockId: 'stray', rule: 'position' }), finding({ lockId: 'stray' })];
    expect(orderOf(serializeFindings(findings, ['hero']))).toEqual([
      'a.html|stray|content',
      'a.html|stray|position',
    ]);
  });

  it('leaves the caller array untouched', () => {
    const findings = [finding({ lockId: 'stray' }), finding({ lockId: 'hero' })];
    serializeFindings(findings, ['hero']);
    expect(findings.map(identity)).toEqual(['a.html|stray|content', 'a.html|hero|content']);
  });
});

describe('determinism', () => {
  const lockOrder = ['zulu', 'alpha', 'mike'];
  const build = () =>
    ['b.html', 'a.html'].flatMap((pagePath) =>
      ['alpha', 'mike', 'zulu'].flatMap((lockId) =>
        RULES.map((rule) => finding({ pagePath, lockId, rule }))));

  it('produces byte-identical output for the same input twice', () => {
    expect(serializeFindings(build(), lockOrder)).toBe(serializeFindings(build(), lockOrder));
  });

  it('produces byte-identical output for the same findings shuffled differently', () => {
    expect(serializeFindings(build().toReversed(), lockOrder)).toBe(
      serializeFindings(build(), lockOrder),
    );
  });
});

describe('validation', () => {
  it('throws when a finding contradicts the schema', () => {
    const mismatched = {
      lockId: 'hero',
      rule: 'position',
      pagePath: 'a.html',
      domPath: 'main > h1',
      verdict: 'pass',
      confidence: null,
      reason: 'Checked.',
      checker: 'deterministic_content_normalizer',
    } as unknown as Finding;
    expect(() => serializeFindings([mismatched], ['hero'])).toThrow();
  });

  it('throws when a finding carries an unknown key', () => {
    const extra = { ...finding(), note: 'extra' } as unknown as Finding;
    expect(() => serializeFindings([extra], ['hero'])).toThrow();
  });

  it('throws on a deterministic finding that claims a confidence', () => {
    const confident = { ...finding(), confidence: 0.4 } as unknown as Finding;
    expect(() => serializeFindings([confident], ['hero'])).toThrow();
  });
});
