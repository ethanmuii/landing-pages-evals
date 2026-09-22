import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { measureLock } from '../../src/browser/extract.js';
import { withRenderedPage } from '../../src/browser/session.js';
import { loadContract, type LoadedContract } from '../../src/contracts/load.js';
import { validatePage } from '../../src/validation/validate-page.js';
import { openSharedSession, type SharedSession } from '../browser/shared-session.js';

const original = '<main><header data-locked="header">Headline</header><footer data-locked="footer">Legal</footer></main>';
let shared: SharedSession;
let directory: string;
let contract: LoadedContract;

beforeAll(async () => {
  shared = await openSharedSession();
});

afterAll(async () => {
  await shared.close();
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'validate-page-'));
  const measurements = await withRenderedPage(shared.session, original, async (page) => ({
    header: await measureLock(page, 'header'),
    footer: await measureLock(page, 'footer'),
  }));
  const locks = [
    {
      lockId: 'header', baselinePath: 'header.html',
      policy: { content: true, appearance: true, position: true },
      baseline: {
        ...measurements.header, parentTag: 'main', previousSiblingTag: null, nextSiblingTag: 'footer',
      },
    },
    {
      lockId: 'footer', baselinePath: 'footer.html',
      policy: { content: true, appearance: true, position: true },
      baseline: {
        ...measurements.footer, parentTag: 'main', previousSiblingTag: 'header', nextSiblingTag: null,
      },
    },
  ];
  await writeFile(join(directory, 'contract.json'), JSON.stringify(locks));
  await writeFile(join(directory, 'header.html'), '<header data-locked="header">Headline</header>');
  await writeFile(join(directory, 'footer.html'), '<footer data-locked="footer">Legal</footer>');
  contract = await loadContract(join(directory, 'contract.json'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('whole-page deterministic gate', () => {
  it('emits three findings per lock in contract order', async () => {
    const findings = await validatePage(shared.session, contract, 'page.html', original);
    expect(findings.map(({ lockId, rule, verdict }) => `${lockId}:${rule}:${verdict}`)).toEqual([
      'header:content:pass', 'header:appearance:pass', 'header:position:pass',
      'footer:content:pass', 'footer:appearance:pass', 'footer:position:pass',
    ]);
  });

  it('continues checking the footer when the header lock is missing', async () => {
    const html = '<main><header>Headline</header><footer data-locked="footer">Legal</footer></main>';
    const findings = await validatePage(shared.session, contract, 'page.html', html);
    expect(findings[0]).toMatchObject({
      lockId: 'header', rule: 'structural_ambiguity', checker: 'presence_precondition', verdict: 'fail',
    });
    expect(findings.slice(1).map(({ lockId, rule }) => `${lockId}:${rule}`)).toEqual([
      'footer:content', 'footer:appearance', 'footer:position',
    ]);
  });

  it('keeps structural wrapper drift clean when text, look and macro position match', async () => {
    const wrapped = '<main><div><header data-locked="header">Headline</header></div><footer data-locked="footer">Legal</footer></main>';
    const findings = await validatePage(shared.session, contract, 'page.html', wrapped);
    expect(findings.map(({ verdict }) => verdict)).toEqual(['pass', 'pass', 'pass', 'pass', 'pass', 'pass']);
  });

  it('returns two presence failures when both locks are missing', async () => {
    const findings = await validatePage(shared.session, contract, 'page.html', '<main>Nothing locked</main>');
    expect(findings.map(({ lockId, checker }) => `${lockId}:${checker}`)).toEqual([
      'header:presence_precondition', 'footer:presence_precondition',
    ]);
  });
});
