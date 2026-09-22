import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LockMeasurement } from '../../src/browser/extract.js';
import { loadContract } from '../../src/contracts/load.js';
import { parsePage } from '../../src/locks/locate.js';
import { validateLock } from '../../src/validation/validate-lock.js';
import { createBaseline } from '../fixtures/baseline.js';

let directory: string;
let contractPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'validate-lock-'));
  contractPath = join(directory, 'contract.json');
  await writeFile(join(directory, 'footer.html'), '<footer data-locked="footer">Legal</footer>');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function contract() {
  await writeFile(contractPath, JSON.stringify([{
    lockId: 'footer', baselinePath: 'footer.html',
    policy: { content: true, appearance: true, position: true },
    baseline: { ...createBaseline(), parentTag: 'main', previousSiblingTag: 'section' },
  }]));
  return loadContract(contractPath);
}

function measurement(change: Partial<LockMeasurement> = {}): LockMeasurement {
  const baseline = createBaseline();
  return {
    visibleText: baseline.visibleText,
    computedStyles: baseline.computedStyles,
    width: baseline.width,
    height: baseline.height,
    ...change,
  };
}

const page = '<main><section>Intro</section><footer data-locked="footer">Legal</footer></main>';

describe('single-lock publish gate', () => {
  it('emits independent content, appearance and position passes', async () => {
    const findings = await validateLock(parsePage(page), await contract(), 'page.html', 'footer',
      async () => measurement());
    expect(findings.map(({ rule, verdict, checker }) => ({ rule, verdict, checker }))).toEqual([
      { rule: 'content', verdict: 'pass', checker: 'deterministic_content_normalizer' },
      { rule: 'appearance', verdict: 'pass', checker: 'playwright_appearance_proxy' },
      { rule: 'position', verdict: 'pass', checker: 'relational_position_anchor' },
    ]);
    expect(findings.every((finding) => finding.domPath === 'body/main[1]/footer[2]')).toBe(true);
  });

  it('reports changed words without changing the other rule verdicts', async () => {
    const findings = await validateLock(parsePage(page), await contract(), 'page.html', 'footer',
      async () => measurement({ visibleText: 'New words' }));
    expect(findings.map(({ verdict }) => verdict)).toEqual(['fail', 'pass', 'pass']);
  });

  it('reports changed styles without changing the other rule verdicts', async () => {
    const findings = await validateLock(parsePage(page), await contract(), 'page.html', 'footer',
      async () => measurement({ computedStyles: { ...createBaseline().computedStyles, color: 'red' } }));
    expect(findings.map(({ verdict }) => verdict)).toEqual(['pass', 'fail', 'pass']);
  });

  it('reports changed neighbours without changing the other rule verdicts', async () => {
    const moved = '<main><footer data-locked="footer">Legal</footer><section>Intro</section></main>';
    const findings = await validateLock(parsePage(moved), await contract(), 'page.html', 'footer',
      async () => measurement());
    expect(findings.map(({ verdict }) => verdict)).toEqual(['pass', 'pass', 'fail']);
  });

  it('ignores structural drift when all user-facing rules pass', async () => {
    const wrapped = '<main><section>Intro</section><div><footer data-locked="footer"><span>Legal</span></footer></div></main>';
    const findings = await validateLock(parsePage(wrapped), await contract(), 'page.html', 'footer',
      async () => measurement());
    expect(findings.map(({ verdict }) => verdict)).toEqual(['pass', 'pass', 'pass']);
  });

  it('emits only one presence failure and skips measurement for a missing lock', async () => {
    const measure = vi.fn(async () => measurement());
    const findings = await validateLock(parsePage('<main>No footer</main>'), await contract(),
      'page.html', 'footer', measure);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'structural_ambiguity', verdict: 'fail', checker: 'presence_precondition' });
    expect(measure).not.toHaveBeenCalled();
  });

  it('emits only one presence failure and skips measurement for duplicate lock ids', async () => {
    const measure = vi.fn(async () => measurement());
    const duplicated = '<main><footer data-locked="footer">One</footer><footer data-locked="footer">Two</footer></main>';
    const findings = await validateLock(parsePage(duplicated), await contract(), 'page.html', 'footer', measure);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toContain('2 duplicate instances');
    expect(measure).not.toHaveBeenCalled();
  });
});
