import { describe, expect, it } from 'vitest';
import { findingSchema, type Finding } from '../../src/findings/finding.js';
import type { Rule } from '../../src/findings/rule.js';
import type { Verdict } from '../../src/findings/verdict.js';
import { summaryTable } from '../../src/output/table.js';

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
  verdict?: Verdict;
  reason?: string;
};

function finding(parts: Parts = {}): Finding {
  const rule = parts.rule ?? 'content';
  const verdict = parts.verdict ?? 'pass';
  const judged = verdict === 'needs_review';
  return findingSchema.parse({
    lockId: parts.lockId ?? 'hero',
    rule,
    pagePath: parts.pagePath ?? 'a.html',
    domPath: rule === 'structural_ambiguity' ? 'NOT_FOUND' : 'main > h1',
    verdict,
    confidence: null,
    checker: judged ? `${CHECKER_FOR_RULE[rule]}_llm_judge` : CHECKER_FOR_RULE[rule],
    reason: parts.reason ?? 'Checked.',
  });
}

describe('the rendered table', () => {
  it('renders header, rows, blank line and count exactly', () => {
    const findings = [
      finding({ pagePath: 'a.html', lockId: 'hero', rule: 'content', reason: 'Text matches.' }),
      finding({
        pagePath: 'index.html',
        lockId: 'cta',
        rule: 'position',
        verdict: 'fail',
        reason: 'Parent changed.',
      }),
    ];
    expect(summaryTable(findings)).toBe(
      'PAGE        LOCK  RULE      VERDICT  REASON\n'
      + 'a.html      hero  content   pass     Text matches.\n'
      + 'index.html  cta   position  fail     Parent changed.\n'
      + '\n'
      + '2 findings: 1 pass, 1 fail, 0 review',
    );
  });

  it('has no trailing newline', () => {
    expect(summaryTable([finding()]).endsWith('\n')).toBe(false);
  });
});

describe('column padding', () => {
  const findings = [
    finding({ lockId: 'a-very-long-lock-identifier' }),
    finding({ lockId: 'cta' }),
  ];
  const lines = summaryTable(findings).split('\n');

  it('widens the lock column for the header and every row', () => {
    expect(lines[0]).toBe('PAGE    LOCK                         RULE     VERDICT  REASON');
    expect(lines[1]).toBe('a.html  a-very-long-lock-identifier  content  pass     Checked.');
    expect(lines[2]).toBe('a.html  cta                          content  pass     Checked.');
  });

  it('starts the rule column at the same offset on the header and both rows', () => {
    expect(lines.slice(0, 3).map((line) => line.search(/RULE|content/u))).toEqual([37, 37, 37]);
  });
});

describe('reason truncation', () => {
  it('cuts a long reason to the width and ends it with an ellipsis', () => {
    const table = summaryTable([finding({ reason: 'x'.repeat(80) })], 60);
    const row = table.split('\n')[1]!;
    expect(row).toBe(`a.html  hero  content  pass     ${'x'.repeat(27)}…`);
    expect(row.length).toBe(60);
    expect(row.endsWith('…')).toBe(true);
  });

  it('leaves a short reason whole and free of an ellipsis', () => {
    const table = summaryTable([finding({ reason: 'Text matches.' })], 60);
    const row = table.split('\n')[1]!;
    expect(row).toBe('a.html  hero  content  pass     Text matches.');
    expect(row).not.toContain('…');
  });

  it('defaults the width to 100', () => {
    const table = summaryTable([finding({ reason: 'x'.repeat(200) })]);
    const row = table.split('\n')[1]!;
    expect(row.length).toBe(100);
    expect(row).toBe(`a.html  hero  content  pass     ${'x'.repeat(67)}…`);
  });

  it('keeps every line inside the width', () => {
    const findings = [
      finding({ pagePath: 'pages/landing/index.html', reason: 'y'.repeat(300) }),
      finding({
        lockId: 'primary-call-to-action',
        rule: 'structural_ambiguity',
        verdict: 'fail',
        reason: 'z'.repeat(300),
      }),
    ];
    for (const line of summaryTable(findings, 80).split('\n')) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it('emits an empty reason cell when no room is left instead of throwing', () => {
    const table = summaryTable([finding({ reason: 'Text matches.' })], 10);
    const row = table.split('\n')[1]!;
    expect(row).toBe('a.html  hero  content  pass');
  });
});

describe('the count line', () => {
  it('counts a mix of verdicts', () => {
    const findings = [
      finding({ verdict: 'pass' }),
      finding({ verdict: 'fail' }),
      finding({ verdict: 'fail' }),
      finding({ verdict: 'needs_review' }),
    ];
    expect(summaryTable(findings).split('\n').at(-1)).toBe('4 findings: 1 pass, 2 fail, 1 review');
  });

  it('counts an all-pass run', () => {
    const findings = [finding(), finding({ lockId: 'cta' })];
    expect(summaryTable(findings).split('\n').at(-1)).toBe('2 findings: 2 pass, 0 fail, 0 review');
  });

  it('never varies the word findings for a single row', () => {
    expect(summaryTable([finding()]).split('\n').at(-1)).toBe('1 findings: 1 pass, 0 fail, 0 review');
  });
});

describe('an empty findings array', () => {
  it('returns the count line alone', () => {
    expect(summaryTable([])).toBe('0 findings: 0 pass, 0 fail, 0 review');
  });
});
