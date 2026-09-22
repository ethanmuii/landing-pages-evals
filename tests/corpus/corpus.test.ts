import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import {
  CORPUS_LOCK_ID,
  CORPUS_PAGES_DIRECTORY,
  MUTATIONS,
  type Mutation,
  type ViolatedRule,
} from '../../fixtures/scripts/build-corpus.js';
import { loadContract } from '../../src/contracts/load.js';
import type { Verdict } from '../../src/findings/verdict.js';
import { validatePage } from '../../src/validation/validate-page.js';
import { openSharedSession } from '../browser/shared-session.js';

const RULES = ['content', 'appearance', 'position'] as const;

// A captured homepage is two orders of magnitude larger than the fixtures the
// rest of the suite renders, and its heaviest page has been seen to take half a
// minute, so the budget is set well clear of that rather than near it.
const PAGE_TIMEOUT_MS = 180_000;

// Approved when the corpus was defined: an edit to the lock's visible text may
// reflow it, so a content page is allowed to fail the appearance rule as well.
// Every other page fails its own rule and nothing else.
const CONTENT_SIDE_EFFECTS: Readonly<Record<string, readonly ViolatedRule[]>> = {
  'content-03.html': ['appearance'],
};

const shared = await openSharedSession();
afterAll(() => shared.close());
const contract = await loadContract('src/fixtures/inputs/baseline-contract.json');

function expectedVerdicts(mutation: Mutation): Record<ViolatedRule, Verdict> {
  const failing = new Set<ViolatedRule>(mutation.rule === null ? [] : [mutation.rule]);
  for (const rule of CONTENT_SIDE_EFFECTS[mutation.pageName] ?? []) {
    failing.add(rule);
  }
  return Object.fromEntries(
    RULES.map((rule) => [rule, failing.has(rule) ? 'fail' : 'pass']),
  ) as Record<ViolatedRule, Verdict>;
}

it.each(MUTATIONS.map((mutation) => [mutation.pageName, mutation] as const))(
  'gates %s exactly as the corpus labels claim',
  async (pageName, mutation) => {
    const html = await readFile(join(CORPUS_PAGES_DIRECTORY, pageName), 'utf8');
    const findings = await validatePage(shared.session, contract, pageName, html);

    expect(findings).toHaveLength(RULES.length);
    expect(findings.map((finding) => finding.rule)).toEqual([...RULES]);
    expect(findings.every((finding) => finding.lockId === CORPUS_LOCK_ID)).toBe(true);
    expect(Object.fromEntries(findings.map((finding) => [finding.rule, finding.verdict])))
      .toEqual(expectedVerdicts(mutation));
  },
  PAGE_TIMEOUT_MS,
);
